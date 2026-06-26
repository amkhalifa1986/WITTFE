import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({ gpsTrackingEnabled: true });
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const response = await api.getSystemSettingsPublic();
      if (response && response.isSuccess && response.data) {
        setSettings(response.data);
        localStorage.setItem('app_settings', JSON.stringify({
          data: response.data,
          time: Date.now()
        }));
      }
    } catch (err) {
      console.error('Failed to load system settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = localStorage.getItem('app_settings');
    if (cached) {
      try {
        const { data, time } = JSON.parse(cached);
        if (Date.now() - time < 5 * 60 * 1000) { // 5-min TTL
          setSettings(data);
          setLoading(false);
          // Don't return here! Fetch in the background to ensure fresh settings
        }
      } catch (e) {
        // ignore parse error
      }
    }
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, refetch: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};
