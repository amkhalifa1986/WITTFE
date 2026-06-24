import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AdContext = createContext(null);

// localStorage key that stores a Set of all "page instances" where the ad was already shown.
// Format: "pageKey" for single-instance pages, "pageKey:instanceId" for detail pages.
const SEEN_ADS_KEY = 'witt_seen_ads';

const getSeenAds = () => {
  try {
    const raw = localStorage.getItem(SEEN_ADS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const saveSeenAds = (set) => {
  try {
    localStorage.setItem(SEEN_ADS_KEY, JSON.stringify([...set]));
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
   * @param {string} pageKey   - admin-configured page identifier (e.g. 'tripDetails')
   * @param {string} instanceId - unique ID of the specific item (e.g. trip.id). Leave blank for single-instance pages.
   */
  const shouldShowAd = (pageKey, instanceId = null) => {
    if (loading) return false;
    // Check admin config — is this page enabled?
    if (!adsConfig[pageKey]) return false;
    // Check if this specific instance was already seen
    const seen = getSeenAds();
    return !seen.has(buildKey(pageKey, instanceId));
  };

  /**
   * Marks the ad for this page instance as seen (persisted to localStorage).
   */
  const markAdShown = (pageKey, instanceId = null) => {
    const seen = getSeenAds();
    seen.add(buildKey(pageKey, instanceId));
    saveSeenAds(seen);
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
