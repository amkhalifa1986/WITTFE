import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { AdInterstitial } from '../components/AdInterstitial';
import { Search as SearchIcon, Train, MapPin, ArrowRight } from 'lucide-react';

export const Search = () => {
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  
  const [searchType, setSearchType] = useState('number'); // 'number' or 'route'
  const [trainNumber, setTrainNumber] = useState('');
  const [fromStop, setFromStop] = useState('');
  const [toStop, setToStop] = useState('');
  const [stops, setStops] = useState([]);
  const [stopsLoading, setStopsLoading] = useState(false);
  
  const [results, setResults] = useState([]);
  const [todayTrips, setTodayTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTodayTrips = async () => {
      try {
        const res = await api.getTodayTrips();
        setTodayTrips(res.data || []);
      } catch (err) {
        console.error('Failed to fetch today\'s trips:', err);
      }
    };
    const fetchStops = async () => {
      setStopsLoading(true);
      try {
        const res = await api.getStops();
        setStops(res.data || []);
      } catch (err) {
        console.error('Failed to fetch stops:', err);
      } finally {
        setStopsLoading(false);
      }
    };
    fetchTodayTrips();
    fetchStops();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResults([]);

    try {
      let params = {};
      if (searchType === 'number') {
        if (!trainNumber.trim()) {
          setError(t('Please enter a train number.'));
          setLoading(false);
          return;
        }
        params.number = trainNumber.trim();
      } else {
        if (!fromStop.trim() || !toStop.trim()) {
          setError(t('Please enter both origin and destination.'));
          setLoading(false);
          return;
        }
        params.from = fromStop.trim();
        params.to = toStop.trim();
      }

      const res = await api.searchTrains(params);
      setResults(res.data || []);
      if (res.data?.length === 0) {
        setError(t('noTrainsFound'));
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getTodayTripForTrain = (trainNo) => {
    return todayTrips.find(t => t.trainNumber === trainNo);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <AdInterstitial pageKey="search" />
      <div>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{t('searchTitle')}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t('searchSub')}</p>
      </div>

      {/* Search Panel */}
      <div className="glass-panel" style={{ padding: '32px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
          <button 
            onClick={() => { setSearchType('number'); setError(''); }}
            style={{
              flexGrow: 1,
              padding: '12px',
              background: 'none',
              border: 'none',
              color: searchType === 'number' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              borderBottom: searchType === 'number' ? '2px solid var(--accent-primary)' : 'none',
              cursor: 'pointer'
            }}
          >
            {t('trainNumberTab')}
          </button>
          <button 
            onClick={() => { setSearchType('route'); setError(''); }}
            style={{
              flexGrow: 1,
              padding: '12px',
              background: 'none',
              border: 'none',
              color: searchType === 'route' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              borderBottom: searchType === 'route' ? '2px solid var(--accent-primary)' : 'none',
              cursor: 'pointer'
            }}
          >
            {t('routeTab')}
          </button>
        </div>

        <form onSubmit={handleSearch}>
          {searchType === 'number' ? (
            <div className="form-group">
              <label>{t('trainNumberTab')}</label>
              <div style={{ position: 'relative' }}>
                <Train size={18} style={{ position: 'absolute', [isRTL ? 'right' : 'left']: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. 980" 
                  value={trainNumber}
                  onChange={(e) => setTrainNumber(e.target.value)}
                  style={{ paddingInlineStart: '48px' }}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>{t('originStation')}</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={18} style={{ position: 'absolute', [isRTL ? 'right' : 'left']: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                  <select 
                    className="input-field" 
                    value={fromStop}
                    onChange={(e) => setFromStop(e.target.value)}
                    style={{ paddingInlineStart: '48px', cursor: 'pointer', appearance: 'auto' }}
                    disabled={stopsLoading}
                  >
                    <option value="">{stopsLoading ? t('loading') : (isRTL ? '-- اختر محطة القيام --' : '-- Select Origin Station --')}</option>
                    {stops.map(stop => (
                      <option key={stop.id} value={stop.code}>
                        {isRTL ? `${stop.nameAr} (${stop.code})` : `${stop.nameEn} (${stop.code})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>{t('destinationStation')}</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={18} style={{ position: 'absolute', [isRTL ? 'right' : 'left']: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                  <select 
                    className="input-field" 
                    value={toStop}
                    onChange={(e) => setToStop(e.target.value)}
                    style={{ paddingInlineStart: '48px', cursor: 'pointer', appearance: 'auto' }}
                    disabled={stopsLoading}
                  >
                    <option value="">{stopsLoading ? t('loading') : (isRTL ? '-- اختر محطة الوصول --' : '-- Select Destination Station --')}</option>
                    {stops.map(stop => (
                      <option key={stop.id} value={stop.code}>
                        {isRTL ? `${stop.nameAr} (${stop.code})` : `${stop.nameEn} (${stop.code})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '16px', fontWeight: 500 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? t('loading') : t('searchBtn')}
          </button>
        </form>

        {/* Results List */}
        {results.length > 0 && (
          <div style={{ marginTop: '32px' }}>
            <h4 style={{ marginBottom: '16px', fontSize: '1rem', color: 'var(--text-primary)' }}>{t('searchResults')}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {results.map((train) => {
                const todayTrip = getTodayTripForTrain(train.trainNumber);
                return (
                  <div 
                    key={train.id}
                    onClick={() => navigate(`/train/${train.id}`)}
                    className="train-result-row"
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      background: 'rgba(120,120,120,0.02)',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--accent-primary)' }}>#{train.trainNumber}</span>
                        {(isRTL ? train.pathNameAr : train.pathNameEn) && (
                          <span className="badge" style={{ background: 'var(--accent-primary-glow)', color: 'var(--accent-primary)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                            {isRTL ? train.pathNameAr : train.pathNameEn}
                          </span>
                        )}
                        <span>{isRTL ? train.nameAr : train.nameEn}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {isRTL ? train.descriptionAr : train.descriptionEn}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {todayTrip ? (
                        <span className="badge badge-on-time" style={{ fontSize: '0.65rem' }}>{t('activeLive')}</span>
                      ) : (
                        <span className="badge badge-info" style={{ fontSize: '0.65rem', background: 'rgba(120,120,120,0.03)' }}>{t('scheduled')}</span>
                      )}
                      <ArrowRight size={16} color="var(--text-muted)" style={{ transform: isRTL ? 'rotate(180deg)' : undefined }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;
