import React, { createContext, useContext, useState } from 'react';
import { useLanguage } from './LanguageContext';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

const PopupContext = createContext(null);

export const PopupProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null); // { message, title, type: 'alert' | 'confirm', resolve }
  const { t, isRTL } = useLanguage();

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const showAlert = (message, title = null) => {
    return new Promise((resolve) => {
      setModal({
        message,
        title: title || (isRTL ? 'تنبيه' : 'Alert'),
        type: 'alert',
        resolve: () => {
          setModal(null);
          resolve();
        }
      });
    });
  };

  const showConfirm = (message, title = null) => {
    return new Promise((resolve) => {
      setModal({
        message,
        title: title || (isRTL ? 'تأكيد' : 'Confirm'),
        type: 'confirm',
        resolve: (result) => {
          setModal(null);
          resolve(result);
        }
      });
    });
  };

  const getToastIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle size={22} color="#10b981" />;
      case 'error': return <XCircle size={22} color="#ef4444" />;
      case 'warning': return <AlertTriangle size={22} color="#f59e0b" />;
      default: return <Info size={22} color="#3b82f6" />;
    }
  };

  return (
    <PopupContext.Provider value={{ toast: showToast, alert: showAlert, confirm: showConfirm }}>
      {children}
      
      {/* Toasts View */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: isRTL ? 'auto' : '24px',
        left: isRTL ? '24px' : 'auto',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        pointerEvents: 'none'
      }}>
        {toasts.map(t => (
          <div 
            key={t.id}
            className="glass-panel"
            style={{
              padding: '16px 24px',
              borderRadius: '12px',
              border: `1px solid ${t.type === 'error' ? 'rgba(239, 68, 68, 0.4)' : t.type === 'warning' ? 'rgba(245, 158, 11, 0.4)' : t.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`,
              borderInlineStart: `5px solid ${t.type === 'error' ? '#ef4444' : t.type === 'warning' ? '#f59e0b' : t.type === 'success' ? '#10b981' : '#3b82f6'}`,
              background: t.type === 'error' ? 'rgba(239, 68, 68, 0.18)' : t.type === 'warning' ? 'rgba(245, 158, 11, 0.18)' : t.type === 'success' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(59, 130, 246, 0.18)',
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-md)',
              backdropFilter: 'var(--glass-blur)',
              pointerEvents: 'auto',
              minWidth: '360px',
              maxWidth: '520px',
              fontSize: '1.05rem',
              fontWeight: 500,
              animation: 'fadeIn 0.25s ease-out',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              direction: isRTL ? 'rtl' : 'ltr'
            }}
          >
            {getToastIcon(t.type)}
            <span style={{ flexGrow: 1, lineHeight: 1.4 }}>{t.message}</span>
            <button 
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '1.3rem',
                padding: '0 4px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      {/* Modal Popup Dialog */}
      {modal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 7, 12, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9998,
          animation: 'fadeIn 0.2s ease-out',
          direction: isRTL ? 'rtl' : 'ltr'
        }}>
          <div className="glass-panel" style={{
            width: '90%',
            maxWidth: '420px',
            padding: '28px',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-lg)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            animation: 'scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            textAlign: isRTL ? 'right' : 'left'
          }}>
            <h4 style={{ 
              margin: '0 0 12px 0', 
              fontSize: '1.25rem', 
              color: 'var(--text-primary)', 
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              {modal.type === 'confirm' ? (
                <Info size={22} color="var(--accent-primary)" />
              ) : (
                <AlertTriangle size={22} color="var(--warning)" />
              )}
              {modal.title}
            </h4>
            <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              {modal.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              {modal.type === 'confirm' && (
                <button 
                  onClick={() => modal.resolve(false)} 
                  className="btn btn-secondary"
                  style={{ padding: '8px 20px', fontSize: '0.85rem' }}
                >
                  {t('cancel')}
                </button>
              )}
              <button 
                onClick={() => modal.resolve(true)} 
                className="btn btn-primary"
                style={{ padding: '8px 20px', fontSize: '0.85rem' }}
              >
                {t('ok') || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PopupContext.Provider>
  );
};

export const usePopup = () => useContext(PopupContext);
