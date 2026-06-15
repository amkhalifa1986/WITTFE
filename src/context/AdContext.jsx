import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AdContext = createContext(null);

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

  const shouldShowAd = (pageKey) => {
    if (loading) return false;
    // Check if ads are enabled for this page from admin config
    const isEnabled = !!adsConfig[pageKey];
    if (!isEnabled) return false;

    // Check if ad was already shown in this session
    const sessionKey = `ad_shown_${pageKey}`;
    const alreadyShown = sessionStorage.getItem(sessionKey);
    return !alreadyShown;
  };

  const markAdShown = (pageKey) => {
    const sessionKey = `ad_shown_${pageKey}`;
    sessionStorage.setItem(sessionKey, 'true');
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
  if (!context) {
    throw new Error('useAds must be used within an AdProvider');
  }
  return context;
};
