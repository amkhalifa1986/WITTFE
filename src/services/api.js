const BASE_URL = 'http://localhost:5245';

class ApiClient {
  constructor() {
    this.accessToken = localStorage.getItem('access_token') || null;
    this.refreshToken = localStorage.getItem('refresh_token') || null;
    this.refreshPromise = null;
    this._inflightRequests = new Map();
    this._cache = new Map();
  }

  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    if (accessToken) {
      localStorage.setItem('access_token', accessToken);
    } else {
      localStorage.removeItem('access_token');
    }
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    } else {
      localStorage.removeItem('refresh_token');
    }
  }

  clearTokens() {
    this.setTokens(null, null);
  }

  async requestWithRetry(endpoint, options, retries = 3) {
    const method = options.method || 'GET';
    for (let i = 0; i < retries; i++) {
      try {
        return await this._doRequest(endpoint, options);
      } catch (err) {
        if (i === retries - 1 || method !== 'GET') throw err;
        // Exponential backoff
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
  }

  async request(endpoint, options = {}) {
    const method = options.method || 'GET';
    const cacheKey = `${method}:${endpoint}`;

    // Request Deduplication for GET requests
    if (method === 'GET' && this._inflightRequests.has(cacheKey)) {
      return this._inflightRequests.get(cacheKey);
    }

    const promise = this.requestWithRetry(endpoint, options);
    
    if (method === 'GET') {
      this._inflightRequests.set(cacheKey, promise);
      promise.finally(() => this._inflightRequests.delete(cacheKey));
    }
    
    return promise;
  }

  async _doRequest(endpoint, options = {}) {
    const url = `${BASE_URL}/${endpoint.replace(/^\//, '')}`;
    
    // Add default headers without forcing no-cache to allow browser/proxy caching
    options.headers = {
      ...options.headers,
    };

    if (!(options.body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
    }

    if (this.accessToken) {
      options.headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
    options.signal = controller.signal;

    let response;
    try {
      response = await fetch(url, options);
    } catch (err) {
      if (!endpoint.includes('system-logs')) {
        this.logError('Frontend', url, `Network/Fetch error: ${err.message}`, err.message, err.stack).catch(() => {});
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    // If unauthorized, attempt token refresh
    if (response.status === 401 && this.refreshToken) {
      try {
        const newTokens = await this.performRefresh();
        if (newTokens && newTokens.accessToken) {
          options.headers['Authorization'] = `Bearer ${newTokens.accessToken}`;
          response = await fetch(url, options); // Retry request
        }
      } catch (err) {
        this.clearTokens();
        window.dispatchEvent(new Event('auth_expired'));
      }
    }

    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
      if (!endpoint.includes('system-logs')) {
        this.logError('Frontend', url, `API request failed: ${errorMsg}`, errorMsg).catch(() => {});
      }
      throw new Error(errorMsg);
    }

    return data;
  }

  async performRefresh() {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken: this.accessToken,
            refreshToken: this.refreshToken
          })
        });

        if (!response.ok) {
          throw new Error('Refresh token invalid');
        }

        const resData = await response.json();
        const { accessToken, refreshToken: newRefreshToken } = resData.data;
        this.setTokens(accessToken, newRefreshToken);
        return { accessToken, refreshToken: newRefreshToken };
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async getCached(key, fetcher, ttlMs = 5 * 60 * 1000) {
    const cached = this._cache.get(key);
    if (cached && Date.now() - cached.time < ttlMs) {
      return cached.data;
    }
    const data = await fetcher();
    this._cache.set(key, { data, time: Date.now() });
    return data;
  }

  // Auth
  async login(email, password, rememberMe = true) {
    const res = await this.request('api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe })
    });
    this.setTokens(res.data.accessToken, res.data.refreshToken);
    return res.data;
  }

  async register(displayName, email, password) {
    return this.request('api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ displayName, email, password })
    });
  }

  async getCurrentUser() {
    return this.request('api/auth/me');
  }

  // Dashboard Stats & Disruptions
  async getDashboardStats() {
    return this.request('api/dashboard');
  }

  async getDisruptions() {
    return this.request('api/dashboard/disruptions');
  }

  // Trips
  async getTodayTrips() {
    return this.request('api/trips/today');
  }

  async getTripDetails(tripId) {
    return this.request(`api/trips/${tripId}`);
  }

  async getFollowedTrips() {
    return this.request('api/trips/followed');
  }

  async followTrip(tripId) {
    return this.request(`api/trips/${tripId}/follow`, { method: 'POST' });
  }

  async unfollowTrip(tripId) {
    return this.request(`api/trips/${tripId}/follow`, { method: 'DELETE' });
  }

  async markPersonalTripStatus(tripId, status) {
    return this.request(`api/trips/${tripId}/my-status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  async updateTripStatus(tripId, status) {
    return this.request(`api/trips/${tripId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  async postTripLiveUpdate(tripId, content, statusTag, crowdState, latitude, longitude) {
    return this.request(`api/trips/${tripId}/updates`, {
      method: 'POST',
      body: JSON.stringify({ content, statusTag, crowdState, latitude, longitude })
    });
  }

  // Trains
  async searchTrains(params) {
    const query = new URLSearchParams(params).toString();
    return this.request(`api/trains/search?${query}`);
  }

  async getTrainDetails(trainId) {
    return this.request(`api/trains/${trainId}`);
  }

  async getTrainTrips(trainId) {
    return this.request(`api/trains/${trainId}/trips`);
  }

  async getTrainFollowers(trainId) {
    return this.request(`api/trains/${trainId}/followers`);
  }

  async getTripFollowers(tripId) {
    return this.request(`api/trips/${tripId}/followers`);
  }


  async getStops() {
    return this.getCached('stops', () => this.request('api/trains/stops'), 10 * 60 * 1000);
  }

  // Train Follow Plans
  async getFollowPlan(trainId) {
    return this.request(`api/trains/${trainId}/follow-plan`);
  }

  async createOrUpdateFollowPlan(trainId, data) {
    return this.request(`api/trains/${trainId}/follow-plan`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async deleteFollowPlan(trainId) {
    return this.request(`api/trains/${trainId}/follow-plan`, {
      method: 'DELETE'
    });
  }

  async getUpcomingTrips() {
    return this.request('api/profile/upcoming-trips');
  }

  async getFollowedTrainsPlan() {
    return this.request('api/profile/followed-trains');
  }

  async getTripTracking(tripId) {
    return this.request(`api/trips/${tripId}/tracking`);
  }

  async submitTelemetry(tripId, latitude, longitude, speed) {
    return this.request(`api/trips/${tripId}/telemetry`, {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, speed })
    });
  }

  async toggleTripNotifications(tripId, enabled) {
    return this.request(`api/trips/${tripId}/notifications`, {
      method: 'PUT',
      body: JSON.stringify({ enabled })
    });
  }

  async toggleReportThanks(updateId) {
    return this.request(`api/trips/updates/${updateId}/thanks`, {
      method: 'POST'
    });
  }

  async requestLiveUpdateRemoval(updateId) {
    return this.request(`api/trips/updates/${updateId}/removal-request`, {
      method: 'POST'
    });
  }

  async getNotifications() {
    return this.request('api/trips/notifications');
  }

  async markNotificationAsRead(notificationId) {
    return this.request(`api/trips/notifications/${notificationId}/read`, {
      method: 'PUT'
    });
  }

  async markAllNotificationsAsRead() {
    return this.request('api/trips/notifications/read', {
      method: 'PUT'
    });
  }

  async uploadTrack(trainId, geoJsonContent) {
    return this.request(`api/admin/trains/${trainId}/upload-track`, {
      method: 'POST',
      body: JSON.stringify({ geoJsonContent })
    });
  }

  async adminGetRailwayPaths() {
    return this.getCached('adminRailwayPaths', () => this.request('api/admin/railway-paths'), 10 * 60 * 1000);
  }

  async getStatusTags() {
    return this.getCached('statusTags', () => this.request('api/status-tags'));
  }

  async getCrowdLevels() {
    return this.getCached('crowdLevels', () => this.request('api/crowd-levels'));
  }

  // Profile
  async getProfile() {
    return this.request('api/profile');
  }

  async updateProfile(displayName, bio, avatarUrl) {
    return this.request('api/profile', {
      method: 'PUT',
      body: JSON.stringify({ displayName, bio, avatarUrl })
    });
  }

  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('api/profile/upload-avatar', {
      method: 'POST',
      body: formData
    });
  }

  async getTripHistory() {
    return this.request('api/profile/history');
  }

  // Suggestions
  async suggestTrain(data) {
    return this.request('api/train-suggestions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getMySuggestions() {
    return this.request('api/train-suggestions/mine');
  }

  async suggestStop(data) {
    return this.request('api/stop-suggestions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getMyStopSuggestions() {
    return this.request('api/stop-suggestions/mine');
  }

  async getCities() {
    return this.getCached('cities', () => this.request('api/lookups/cities'), 10 * 60 * 1000);
  }

  async getGovernorates() {
    return this.getCached('governorates', () => this.request('api/lookups/governorates'), 10 * 60 * 1000);
  }

  // Lost & Found
  async getLostFoundList(type = null) {
    const query = type !== null ? `?type=${type}` : '';
    return this.request(`api/lost-found${query}`);
  }

  async getLostFoundDetails(id) {
    return this.request(`api/lost-found/${id}`);
  }

  async createLostFoundPost(data) {
    return this.request('api/lost-found', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async markLostFoundResolved(id) {
    return this.request(`api/lost-found/${id}/resolve`, { method: 'PUT' });
  }

  async addLostFoundComment(postId, content) {
    return this.request(`api/lost-found/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  }

  async deleteLostFoundComment(commentId) {
    return this.request(`api/lost-found/comments/${commentId}`, { method: 'DELETE' });
  }

  // Admin Panel Endpoints
  async adminGetUsers() {
    return this.request('api/admin/users');
  }

  async adminToggleUserSuspension(userId, isSuspended) {
    return this.request(`api/admin/users/${userId}/suspend`, {
      method: 'PUT',
      body: JSON.stringify({ isSuspended })
    });
  }

  async adminChangeUserRole(userId, role) {
    return this.request(`api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
  }

  async adminGetPendingTrainSuggestions() {
    return this.request('api/admin/suggestions/trains');
  }

  async adminGetPendingStopSuggestions() {
    return this.request('api/admin/suggestions/stops');
  }

  async adminReviewTrainSuggestion(id, status, data) {
    return this.request(`api/admin/suggestions/trains/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ status, ...data })
    });
  }

  async adminReviewStopSuggestion(id, status, data) {
    return this.request(`api/admin/suggestions/stops/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ status, ...data })
    });
  }

  async adminGetPendingLiveUpdates() {
    return this.request('api/admin/trips/updates/pending');
  }

  async adminApproveLiveUpdate(id) {
    return this.request(`api/admin/trips/updates/${id}/approve`, {
      method: 'PUT'
    });
  }

  async adminDeleteLiveUpdate(id) {
    return this.request(`api/admin/trips/updates/${id}`, {
      method: 'DELETE'
    });
  }

  async adminGetLiveUpdateRemovalRequests() {
    return this.request('api/admin/trips/updates/removal-requests');
  }

  async adminDenyLiveUpdateRemoval(id) {
    return this.request(`api/admin/trips/updates/${id}/deny-removal`, {
      method: 'POST'
    });
  }

  async adminGetLostFoundPosts() {
    return this.request('api/admin/lost-found/posts');
  }

  async adminUpdateLostFoundPostStatus(id, status) {
    return this.request(`api/admin/lost-found/posts/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  async adminHideLostFoundComment(id, isHidden) {
    return this.request(`api/admin/lost-found/comments/${id}/hide`, {
      method: 'PUT',
      body: JSON.stringify({ isHidden })
    });
  }

  async adminCreateDisruption(titleAr, titleEn, descriptionAr, descriptionEn, affectedLine) {
    return this.request('api/admin/disruptions', {
      method: 'POST',
      body: JSON.stringify({ titleAr, titleEn, descriptionAr, descriptionEn, affectedLine })
    });
  }

  async adminDeactivateDisruption(id) {
    return this.request(`api/admin/disruptions/${id}/deactivate`, { method: 'PUT' });
  }

  // Stop/City/Gov CRUD
  async adminGetStops() { return this.getCached('adminStops', () => this.request('api/admin/stops'), 5 * 60 * 1000); }
  async adminCreateStop(data) {
    this._cache.delete('adminStops'); this._cache.delete('stops');
    return this.request('api/admin/stops', { method: 'POST', body: JSON.stringify(data) });
  }
  async adminUpdateStop(id, data) {
    this._cache.delete('adminStops'); this._cache.delete('stops');
    return this.request(`api/admin/stops/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async adminDeleteStop(id) {
    this._cache.delete('adminStops'); this._cache.delete('stops');
    return this.request(`api/admin/stops/${id}`, { method: 'DELETE' });
  }

  async adminGetCities() { return this.getCached('adminCities', () => this.request('api/admin/cities'), 5 * 60 * 1000); }
  async adminCreateCity(data) {
    this._cache.delete('adminCities'); this._cache.delete('cities');
    return this.request('api/admin/cities', { method: 'POST', body: JSON.stringify(data) });
  }
  async adminUpdateCity(id, data) {
    this._cache.delete('adminCities'); this._cache.delete('cities');
    return this.request(`api/admin/cities/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async adminDeleteCity(id) {
    this._cache.delete('adminCities'); this._cache.delete('cities');
    return this.request(`api/admin/cities/${id}`, { method: 'DELETE' });
  }

  async adminGetGovernorates() { return this.request('api/admin/governments'); }
  async adminCreateGovernorate(data) {
    return this.request('api/admin/governments', { method: 'POST', body: JSON.stringify(data) });
  }
  async adminUpdateGovernorate(id, data) {
    return this.request(`api/admin/governments/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async adminDeleteGovernorate(id) {
    return this.request(`api/admin/governments/${id}`, { method: 'DELETE' });
  }

  async adminGetTrains() { return this.request('api/admin/trains'); }
  async adminCreateTrain(data) {
    return this.request('api/admin/trains', { method: 'POST', body: JSON.stringify(data) });
  }
  async adminUpdateTrain(id, data) {
    return this.request(`api/admin/trains/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async adminDeleteTrain(id) {
    return this.request(`api/admin/trains/${id}`, { method: 'DELETE' });
  }

  async adminGetTrips() { return this.request('api/admin/trips'); }
  async adminCreateTrip(data) {
    return this.request('api/admin/trips', { method: 'POST', body: JSON.stringify(data) });
  }
  async adminUpdateTripStatus(id, data) {
    return this.request(`api/admin/trips/${id}/status`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async adminDeleteTrip(id) {
    return this.request(`api/admin/trips/${id}`, { method: 'DELETE' });
  }


  // System Settings
  async adminGetSystemSettings() { return this.request('api/admin/system-settings'); }
  async adminUpdateSystemSettings(data) {
    return this.request('api/admin/system-settings', { method: 'PUT', body: JSON.stringify(data) });
  }
  async getSystemSettingsPublic() {
    return this.request('api/settings');
  }
  async getAdSettings() {
    return this.request('api/ad-settings');
  }

  async logAdImpression(screenId, visitorId, trainNumber = null) {
    return this.request('api/ads/impression', {
      method: 'POST',
      body: JSON.stringify({ screenId, visitorId, trainNumber })
    });
  }

  async logAdClick(screenId, visitorId, trainNumber = null) {
    return this.request('api/ads/click', {
      method: 'POST',
      body: JSON.stringify({ screenId, visitorId, trainNumber })
    });
  }

  // Import
  async adminImportStops(csvContent) {
    const formData = new FormData();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    formData.append('file', blob, 'stops.csv');
    return this.request('api/admin/stops/import', {
      method: 'POST',
      body: formData
    });
  }

  async adminImportTrains(csvContent) {
    const formData = new FormData();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    formData.append('file', blob, 'trains.csv');
    return this.request('api/admin/trains/import', {
      method: 'POST',
      body: formData
    });
  }

  async reportLog(logData) {
    return this.request('api/system-logs', {
      method: 'POST',
      body: JSON.stringify(logData)
    });
  }

  async logError(source, target, description, errorMessage = null, stackTrace = null) {
    return this.reportLog({
      logLevel: 'Error',
      source,
      target,
      description,
      errorMessage,
      stackTrace
    }).catch(() => {}); // catch and ignore to prevent recursive errors
  }

  async getGalleryItems() {
    return this.request('api/gallery');
  }

  resolveImageUrl(url) {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    return `${BASE_URL}/${url.replace(/^\//, '')}`;
  }
}

export const api = new ApiClient();
export default api;
