import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { usePopup } from '../context/PopupContext';
import { Mail, Loader, ArrowLeft } from 'lucide-react';
import api from '../services/api';

export const ResetPassword = () => {
  const { t } = useLanguage();
  const { toast } = usePopup();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const isRTL = document.documentElement.dir === 'rtl';

  const validateEmail = (val) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(val);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError(t('Please fill in all fields.') || 'Please fill in all fields.');
      return;
    }

    if (!validateEmail(email.trim())) {
      setError(t('invalidEmailFormat') || 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.requestPasswordReset(email.trim());
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'radial-gradient(circle at top right, color-mix(in srgb, var(--accent-primary) 15%, transparent) 0%, var(--bg-primary) 70%)',
      padding: '20px'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            marginBottom: '16px',
            boxShadow: '0 8px 24px color-mix(in srgb, var(--accent-primary) 20%, transparent)'
          }}>
            <img src="/logo-light.png" alt="WITT logo" style={{ width: '100%', height: '100%', borderRadius: '16px', objectFit: 'cover' }} />
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {t('resetPasswordPageTitle')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            {submitted ? '' : t('resetPasswordPageDesc')}
          </p>
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-glow)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: 'var(--danger)',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '0.9rem',
            fontWeight: 500
          }}>
            {error}
          </div>
        )}

        {submitted ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              color: '#10b981',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '32px',
              fontSize: '1rem',
              fontWeight: 500,
              lineHeight: '1.6'
            }}>
              {t('checkEmailMsg')}
            </div>
            
            <button 
              type="button" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              onClick={() => navigate('/login')}
            >
              <ArrowLeft size={18} style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }} />
              {t('backToLogin')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleResetPassword}>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label>{t('emailAddress')}</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', [isRTL ? 'right' : 'left']: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="email" 
                  className="input-field" 
                  placeholder="name@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingInlineStart: '48px' }}
                  disabled={loading}
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '14px', marginBottom: '20px' }}
              disabled={loading}
            >
              {loading ? <Loader className="animate-spin" size={18} /> : t('resetPasswordPageTitle')}
            </button>

            <button 
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              onClick={() => navigate('/login')}
              disabled={loading}
            >
              <ArrowLeft size={18} style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }} />
              {t('backToLogin')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
