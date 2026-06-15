import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { AdInterstitial } from '../components/AdInterstitial';
import { Lightbulb, Info, Clock, CheckCircle, XCircle } from 'lucide-react';

export const Suggestions = () => {
  const { t, isRTL } = useLanguage();
  
  const [trainNumber, setTrainNumber] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [routeDescriptionEn, setRouteDescriptionEn] = useState('');
  const [routeDescriptionAr, setRouteDescriptionAr] = useState('');
  
  const [mySuggestions, setMySuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchSuggestions = async () => {
    try {
      const res = await api.getMySuggestions();
      setMySuggestions(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!trainNumber.trim() || !nameEn.trim()) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await api.suggestTrain({
        trainNumber: trainNumber.trim(),
        nameAr: nameAr.trim() || nameEn.trim(),
        nameEn: nameEn.trim(),
        descriptionAr: descriptionAr.trim() || null,
        descriptionEn: descriptionEn.trim() || null,
        routeDescriptionAr: routeDescriptionAr.trim() || null,
        routeDescriptionEn: routeDescriptionEn.trim() || null
      });

      setSuccess(t('Thank you! Your route suggestion has been submitted to moderators.'));
      setTrainNumber('');
      setNameEn('');
      setNameAr('');
      setDescriptionEn('');
      setDescriptionAr('');
      setRouteDescriptionEn('');
      setRouteDescriptionAr('');
      
      fetchSuggestions();
    } catch (err) {
      setError(err.message || 'Failed to submit route suggestion.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="badge badge-on-time" style={{ fontSize: '0.7rem' }}>
            <CheckCircle size={10} /> {t('approved')}
          </span>
        );
      case 'Rejected':
        return (
          <span className="badge badge-cancelled" style={{ fontSize: '0.7rem' }}>
            <XCircle size={10} /> {t('rejected')}
          </span>
        );
      default:
        return (
          <span className="badge badge-delayed" style={{ fontSize: '0.7rem' }}>
            <Clock size={10} /> {t('pending')}
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <AdInterstitial pageKey="suggestions" />
      <div>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{t('suggestions')}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t('suggestionsSub')}</p>
      </div>

      <div className="dashboard-grid">
        {/* Propose Form */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Lightbulb size={22} color="var(--accent-primary)" /> {t('submitSuggestion')}
          </h3>

          {error && <div style={{ color: 'var(--danger)', marginBottom: '16px', fontWeight: 500 }}>{error}</div>}
          {success && <div style={{ color: 'var(--success)', marginBottom: '16px', fontWeight: 500 }}>{success}</div>}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
              <div className="form-group">
                <label>{t('trainNumberTab')}</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. 980" 
                  value={trainNumber}
                  onChange={(e) => setTrainNumber(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label>{t('trainNameEn')}</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Cairo - Aswan VIP" 
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="form-group">
              <label>{t('trainNameAr')}</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="مثال: قطار القاهرة أسوان" 
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>{t('descEn')}</label>
                <textarea 
                  className="input-field" 
                  rows="2" 
                  placeholder="Service type, comfort..."
                  value={descriptionEn}
                  onChange={(e) => setDescriptionEn(e.target.value)}
                  disabled={submitting}
                  style={{ resize: 'none' }}
                ></textarea>
              </div>

              <div className="form-group">
                <label>{t('descAr')}</label>
                <textarea 
                  className="input-field" 
                  rows="2" 
                  placeholder="تفاصيل الخدمة والدرجة..."
                  value={descriptionAr}
                  onChange={(e) => setDescriptionAr(e.target.value)}
                  disabled={submitting}
                  style={{ resize: 'none' }}
                ></textarea>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>{t('routeEn')}</label>
                <textarea 
                  className="input-field" 
                  rows="2" 
                  placeholder="Cairo -> Giza -> Minya -> Luxor"
                  value={routeDescriptionEn}
                  onChange={(e) => setRouteDescriptionEn(e.target.value)}
                  disabled={submitting}
                  style={{ resize: 'none' }}
                ></textarea>
              </div>

              <div className="form-group">
                <label>{t('routeAr')}</label>
                <textarea 
                  className="input-field" 
                  rows="2" 
                  placeholder="القاهرة -> الجيزة -> المنيا -> الأقصر"
                  value={routeDescriptionAr}
                  onChange={(e) => setRouteDescriptionAr(e.target.value)}
                  disabled={submitting}
                  style={{ resize: 'none' }}
                ></textarea>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={submitting || !trainNumber.trim() || !nameEn.trim()}>
              {submitting ? t('loading') : t('submitSuggestion')}
            </button>
          </form>
        </div>

        {/* Suggestion History */}
        <div className="glass-panel" style={{ padding: '32px', minHeight: '400px' }}>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Info size={22} color="var(--accent-secondary)" /> {t('myProposalLog')}
          </h3>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
              <Clock className="animate-spin" size={24} color="var(--accent-primary)" />
            </div>
          ) : mySuggestions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '40px' }}>
              {t('noSuggestionsYet')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {mySuggestions.map((sug) => (
                <div 
                  key={sug.id}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(120,120,120,0.01)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                      <span style={{ color: 'var(--accent-primary)', marginInlineEnd: '6px' }}>#{sug.trainNumber}</span>
                      {isRTL ? sug.nameAr : sug.nameEn}
                    </span>
                    {getStatusBadge(sug.status)}
                  </div>
                  
                  {(isRTL ? sug.routeDescriptionAr : sug.routeDescriptionEn) && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      <strong>{isRTL ? 'المحطات:' : 'Route:'}</strong> {isRTL ? sug.routeDescriptionAr : sug.routeDescriptionEn}
                    </div>
                  )}

                  {sug.adminNotes && (
                    <div style={{ 
                      marginTop: '8px', 
                      padding: '8px 12px', 
                      background: 'rgba(245, 158, 11, 0.05)', 
                      border: '1px solid rgba(245, 158, 11, 0.1)', 
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      color: 'var(--warning)'
                    }}>
                      <strong>{t('adminNotes')}:</strong> {sug.adminNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Suggestions;
