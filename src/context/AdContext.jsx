import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AdContext = createContext(null);

// sessionStorage key that stores timestamps when ads were shown.
// Limit: shown just one time per page per 1 hour, stored in browser session.
const AD_SESSION_KEY = 'witt_ad_session_timestamps';
const ONE_HOUR_MS = 60 * 60 * 1000; // 1 hour in milliseconds

const getSeenAdTimestamps = () => {
  try {
    const raw = sessionStorage.getItem(AD_SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveSeenAdTimestamps = (timestamps) => {
  try {
    sessionStorage.setItem(AD_SESSION_KEY, JSON.stringify(timestamps));
  } catch { /* storage full — ignore */ }
};

export const AdProvider = ({ children }) => {
  const [adsConfig, setAdsConfig] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdSettings = async () => {
      try {
        const response = await api.getAdSettings();
        if (response && response.isSuccess) {
          const config = typeof response.data === 'string'
            ? JSON.parse(response.data)
            : (response.data || {});
          setAdsConfig(config);
        }
      } catch (err) {
        console.error('Failed to load ad settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAdSettings();
  }, []);

  const [visitorId] = useState(() => {
    let saved = localStorage.getItem('witt_ad_visitor_id');
    if (!saved) {
      saved = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'visitor-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
      localStorage.setItem('witt_ad_visitor_id', saved);
    }
    return saved;
  });

  /**
   * Build the composite key used for deduplication.
   * - Single-instance pages (dashboard, search …): key = pageKey
   * - Detail pages (trip, train …): key = "pageKey:instanceId"
   */
  const buildKey = (pageKey, instanceId) =>
    instanceId ? `${pageKey}:${instanceId}` : pageKey;

  /**
   * Returns true if the ad should be shown for this specific page instance.
   * Ad is shown once per page per 1 hour in the browser session.
   * @param {string} pageKey   - admin-configured page identifier (e.g. 'tripDetails')
   * @param {string} instanceId - unique ID of the specific item (e.g. trip.id). Leave blank for single-instance pages.
   */
  const shouldShowAd = (pageKey, instanceId = null) => {
    if (loading) return false;
    // Check admin config — is this page enabled?
    if (!adsConfig[pageKey]) return false;
    // Check 1-hour session limit
    const key = buildKey(pageKey, instanceId);
    const timestamps = getSeenAdTimestamps();
    const lastShown = timestamps[key];
    if (!lastShown) return true;
    return Date.now() - lastShown >= ONE_HOUR_MS;
  };

  /**
   * Marks the ad for this page instance as seen in sessionStorage with current timestamp.
   */
  const markAdShown = (pageKey, instanceId = null) => {
    const key = buildKey(pageKey, instanceId);
    const timestamps = getSeenAdTimestamps();
    timestamps[key] = Date.now();
    saveSeenAdTimestamps(timestamps);
  };

  const trackImpression = async (pageKey, trainNumber = null) => {
    try {
      await api.logAdImpression(pageKey, visitorId, trainNumber);
    } catch (err) {
      console.error('Failed to log ad impression:', err);
    }
  };

  const trackClick = async (pageKey, trainNumber = null) => {
    try {
      await api.logAdClick(pageKey, visitorId, trainNumber);
    } catch (err) {
      console.error('Failed to log ad click:', err);
    }
  };

  return (
    <AdContext.Provider value={{ adsConfig, loading, shouldShowAd, markAdShown, trackImpression, trackClick }}>
      {children}
    </AdContext.Provider>
  );
};

export const useAds = () => {
  const context = useContext(AdContext);
  if (!context) throw new Error('useAds must be used within an AdProvider');
  return context;
};
