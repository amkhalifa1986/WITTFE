import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useAds } from '../context/AdContext';
import { useLanguage } from '../context/LanguageContext';

export const AdInterstitial = ({ pageKey, instanceId = null, trainNumber = null }) => {
  const { shouldShowAd, markAdShown, trackImpression, trackClick } = useAds();
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const adRef = useRef(null);

  useEffect(() => {
    if (shouldShowAd(pageKey, instanceId)) {
      setVisible(true);
      trackImpression(pageKey, trainNumber);
      try {
        if (window.adsbygoogle) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
      } catch (e) {
        console.error('Failed to load Google AdSense unit:', e);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey, instanceId]);

  useEffect(() => {
    if (!visible) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible]);

  const handleClose = () => {
    if (countdown > 0) return;
    setVisible(false);
    markAdShown(pageKey, instanceId);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.95)', // dark premium background
      backdropFilter: 'blur(12px)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      {/* Container Card */}
      <div className="glass-panel" style={{
        position: 'relative',
        width: '100%',
        maxWidth: '400px',
        background: 'rgba(30, 41, 59, 0.7)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 24px 24px 24px',
        overflow: 'hidden'
      }}>
        
        {/* Countdown/Close Header */}
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          left: '16px',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          height: '36px'
        }}>
          {countdown > 0 ? (
            <span style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              padding: '6px 12px',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              {t('skipIn').replace('{seconds}', countdown)}
            </span>
          ) : (
            <button
              onClick={handleClose}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              }}
              title={t('closeAd')}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Sponsor/Ad Title */}
        <div style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--accent-primary)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: '20px',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          padding: '4px 10px',
          borderRadius: '6px'
        }}>
          Sponsored Advertisement
        </div>

        {/* Google AdSense Responsive Ad Placement Slot or Fallback Mock Ad */}
        {window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? (
          <div 
            onClick={() => {
              trackClick(pageKey, trainNumber);
              window.open('https://whereisthetrain.com/premium', '_blank');
            }}
            style={{
              width: '100%',
              minHeight: '280px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(30, 41, 59, 0.5)',
              borderRadius: '16px',
              border: '2px dashed var(--accent-primary)',
              padding: '16px',
              marginBottom: '24px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-secondary)';
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
              e.currentTarget.style.background = 'rgba(30, 41, 59, 0.5)';
            }}
          >
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Go WITT Premium
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', maxWidth: '250px' }}>
              Enjoy ad-free experience, unlimited train follow plans, and instant arrival alerts.
            </p>
            <span className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem', pointerEvents: 'none' }}>
              Learn More
            </span>
            <div style={{ position: 'absolute', bottom: '8px', right: '12px', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              Development Fallback Ad
            </div>
          </div>
        ) : (
          <div style={{
            width: '100%',
            minHeight: '280px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            padding: '8px',
            marginBottom: '24px'
          }} ref={adRef}>
            <ins className="adsbygoogle"
                 style={{ display: 'block', width: '100%', height: '280px' }}
                 data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
                 data-ad-slot="1234567890"
                 data-ad-format="auto"
                 data-full-width-responsive="true"></ins>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleClose}
          disabled={countdown > 0}
          className="btn"
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '0.95rem',
            fontWeight: 600,
            borderRadius: '12px',
            background: countdown > 0 
              ? 'rgba(255, 255, 255, 0.03)' 
              : 'linear-gradient(135deg, var(--accent-primary), #1d4ed8)',
            border: 'none',
            color: countdown > 0 ? 'var(--text-secondary)' : '#ffffff',
            cursor: countdown > 0 ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: countdown > 0 ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}
        >
          {countdown > 0 ? t('skipIn').replace('{seconds}', countdown) : t('closeAd')}
        </button>
      </div>
    </div>
  );
};
