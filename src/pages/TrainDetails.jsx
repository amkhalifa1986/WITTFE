import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/authContext';
import { 
  Train, 
  MapPin, 
  Clock, 
  Navigation,
  Star,
  StarOff,
  X,
  ArrowRight,
  Edit,
  Calendar
} from 'lucide-react';
import { AdInterstitial } from '../components/AdInterstitial';

export const TrainDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  
  const { user } = useAuth();
  const isAdmin = user && (user.role === 1 || user.role === 'Admin');

  const [train, setTrain] = useState(null);
  const [todayTrip, setTodayTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [errorTrips, setErrorTrips] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tripsPage, setTripsPage] = useState(1);

  const fetchTrainTrips = async () => {
    try {
      setLoadingTrips(true);
      setErrorTrips('');
      const res = await api.getTrainTrips(id);
      if (res.isSuccess) {
        setTrips(res.data || []);
      } else {
        setErrorTrips(res.error || (isRTL ? 'فشل في تحميل الرحلات.' : 'Failed to fetch trips.'));
      }
    } catch (err) {
      console.error(err);
      setErrorTrips(isRTL ? 'فشل في تحميل الرحلات.' : 'Failed to fetch trips.');
    } finally {
      setLoadingTrips(false);
    }
  };
  
  // Follow Plan States
  const [followPlan, setFollowPlan] = useState(null);
  const [loadingFollowPlan, setLoadingFollowPlan] = useState(false);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [submittingFollowPlan, setSubmittingFollowPlan] = useState(false);
  const [dailyConfigs, setDailyConfigs] = useState([]);

  const fetchTrainDetails = async () => {
    try {
      setLoading(true);
      const res = await api.getTrainDetails(id);
      if (res.isSuccess) {
        setTrain(res.data);
      } else {
        setError(res.error || t('noStopsInfo'));
      }
    } catch (err) {
      console.error(err);
      setError(t('Failed to retrieve train details.'));
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayTrip = async () => {
    try {
      const res = await api.getTodayTrips();
      if (res.data && train) {
        const trip = res.data.find(t => t.trainNumber === train.trainNumber);
        setTodayTrip(trip || null);
      }
    } catch (err) {
      console.error('Failed to fetch today\'s trip:', err);
    }
  };

  const fetchFollowPlan = async () => {
    setLoadingFollowPlan(true);
    try {
      const res = await api.getFollowPlan(id);
      if (res.isSuccess && res.data && res.data.length > 0) {
        setFollowPlan(res.data);
      } else {
        setFollowPlan(null);
      }
    } catch (err) {
      setFollowPlan(null);
    } finally {
      setLoadingFollowPlan(false);
    }
  };

  useEffect(() => {
    fetchTrainDetails();
    fetchTrainTrips();
  }, [id]);

  useEffect(() => {
    if (train) {
      fetchTodayTrip();
      fetchFollowPlan();
    }
  }, [train]);

  const openFollowModal = () => {
    if (!train) return;
    const defaultStop = train.routeStops && train.routeStops.length > 0 
      ? train.routeStops[train.routeStops.length - 1].stopId 
      : '';

    const newConfigs = Array.from({ length: 7 }, (_, index) => {
      const plan = followPlan?.find(p => p.dayOfWeek === index);
      if (plan) {
        return {
          dayOfWeek: index,
          enabled: true,
          roleType: plan.roleType === 'Passenger' ? 0 : 1,
          targetStopId: plan.targetStopId,
          alertLeadTimeMinutes: plan.alertLeadTimeMinutes
        };
      } else {
        return {
          dayOfWeek: index,
          enabled: false,
          roleType: 1,
          targetStopId: defaultStop,
          alertLeadTimeMinutes: 15
        };
      }
    });

    setDailyConfigs(newConfigs);
    setShowFollowModal(true);
  };

  const handleSaveFollowPlan = async (e) => {
    e.preventDefault();
    
    const activeConfigs = dailyConfigs.filter(c => c.enabled);
    if (activeConfigs.length === 0) {
      alert(t('pleaseEnableFollowOneDay'));
      return;
    }

    for (const config of activeConfigs) {
      if (!config.targetStopId) {
        alert(t('pleaseSelectTargetStationAllDays'));
        return;
      }
    }

    setSubmittingFollowPlan(true);
    try {
      const payload = activeConfigs.map(c => ({
        dayOfWeek: c.dayOfWeek,
        roleType: c.roleType,
        targetStopId: c.targetStopId,
        alertLeadTimeMinutes: c.alertLeadTimeMinutes
      }));

      const res = await api.createOrUpdateFollowPlan(train.id, payload);
      if (res.isSuccess) {
        setFollowPlan(res.data && res.data.length > 0 ? res.data : null);
        setShowFollowModal(false);
        alert(t('planSaved'));
      }
    } catch (err) {
      console.error(err);
      alert(err.message || t('failedToSaveFollowPlan'));
    } finally {
      setSubmittingFollowPlan(false);
    }
  };

  const handleUnfollowTrain = async () => {
    if (!window.confirm(t('unfollowPlanConfirm'))) return;

    try {
      const res = await api.deleteFollowPlan(train.id);
      if (res.isSuccess) {
        setFollowPlan(null);
        alert(t('planDeleted'));
      }
    } catch (err) {
      console.error(err);
      alert(err.message || t('failedToCancelFollowPlan'));
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <Clock className="animate-spin" size={32} color="var(--accent-primary)" />
      </div>
    );
  }

  if (error || !train) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <p>{error || t('noStopsInfo')}</p>
        <button onClick={() => navigate('/search')} className="btn btn-primary" style={{ marginTop: '20px' }}>
          {t('backToSearch')}
        </button>
      </div>
    );
  }
  // Filter trips by date range
  const filteredTrips = trips.filter(trip => {
    if (dateFrom && trip.tripDate < dateFrom) return false;
    if (dateTo && trip.tripDate > dateTo) return false;
    return true;
  });

  const totalTripsPages = Math.ceil(filteredTrips.length / 5);
  const paginatedTrips = filteredTrips.slice(
    (tripsPage - 1) * 5,
    tripsPage * 5
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <AdInterstitial pageKey="trainDetails" trainNumber={train.trainNumber} />
      {/* Header Panel */}
      <div className="glass-panel" style={{ padding: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            background: 'var(--accent-gradient)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: 800,
            fontFamily: 'Outfit'
          }}>
            {train.trainNumber}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {isRTL ? train.nameAr : train.nameEn}
              </h1>
              {todayTrip ? (
                <span className="badge badge-on-time">{t('activeLive')}</span>
              ) : (
                <span className="badge badge-info">{t('scheduled')}</span>
              )}
              {(isRTL ? train.trainTypeNameAr : train.trainTypeNameEn) && (
                <span className="badge badge-info" style={{ textTransform: 'none' }}>
                  {isRTL ? train.trainTypeNameAr : train.trainTypeNameEn}
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
              {isRTL ? train.descriptionAr : train.descriptionEn}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {isAdmin && (
            <button 
              onClick={() => navigate(`/edit-train/${train.id}`)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Edit size={16} /> {t('editTrain')}
            </button>
          )}
          {todayTrip && (
            <button 
              onClick={() => navigate(`/trip/${todayTrip.id}`)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Navigation size={16} /> {t('trackLive')}
            </button>
          )}

          {loadingFollowPlan ? (
            <button className="btn btn-secondary" disabled>{t('loading')}</button>
          ) : followPlan ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={openFollowModal}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Star size={16} /> {t('editPlan')}
              </button>
              <button 
                onClick={handleUnfollowTrain}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', borderColor: 'rgba(239, 68, 68, 0.4)', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }}
              >
                <StarOff size={16} /> {t('unfollowPlan')}
              </button>
            </div>
          ) : (
            <button 
              onClick={openFollowModal}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Star size={16} /> {t('follow')}
            </button>
          )}
        </div>
      </div>

      {/* Main Content Info */}
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px', alignItems: 'start' }}>
        {/* Left Column: Timetable */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={20} color="var(--accent-primary)" /> {t('timetableHeader')}
          </h3>

          {train.routeStops && train.routeStops.length > 0 ? (
            <div className="trip-timeline">
              {train.routeStops.map((stop) => (
                <div key={stop.stopId} className="timeline-item">
                  <div className="timeline-node"></div>
                  <div className="timeline-content">
                    <div className="station-details">
                      <div className="station-name">{isRTL ? stop.stopNameAr : stop.stopNameEn}</div>
                      <div className="station-info">{isRTL ? stop.stopNameEn : stop.stopNameAr} ({stop.stopCode})</div>
                    </div>
                    <div className="station-time">
                      {stop.scheduledArrival && <div>{isRTL ? 'وصول' : 'Arr'}: {stop.scheduledArrival.slice(0, 5)}</div>}
                      {stop.scheduledDeparture && <div>{isRTL ? 'تحرك' : 'Dep'}: {stop.scheduledDeparture.slice(0, 5)}</div>}
                      {stop.stopOrder === 1 && <span style={{ color: 'var(--accent-secondary)' }}>{t('origin')}</span>}
                      {stop.stopOrder === train.routeStops.length && <span style={{ color: 'var(--accent-primary)' }}>{t('terminal')}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('noStopsInfo')}</p>
          )}
        </div>

        {/* Right Column: Latest Trips & Followers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Latest Trips Card */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
              <Calendar size={18} color="var(--accent-secondary)" />
              <span>{t('latestTrips')}</span>
            </h3>
            
            {/* Filters */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem', marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>
                  {t('dateFrom')}
                </label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={dateFrom} 
                  onChange={(e) => { setDateFrom(e.target.value); setTripsPage(1); }} 
                  style={{ height: '36px', fontSize: '0.85rem' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem', marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>
                  {t('dateTo')}
                </label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={dateTo} 
                  onChange={(e) => { setDateTo(e.target.value); setTripsPage(1); }} 
                  style={{ height: '36px', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '120px' }}>
              {loadingTrips ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
                  <Clock className="animate-spin" size={24} color="var(--accent-primary)" />
                </div>
              ) : errorTrips ? (
                <div style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>
                  {errorTrips}
                </div>
              ) : filteredTrips.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '40px 10px' }}>
                  {t('noTripsScheduled')}
                </div>
              ) : (
                paginatedTrips.map((trip) => (
                  <div 
                    key={trip.id} 
                    onClick={() => navigate(`/trip/${trip.id}`)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '12px 16px', 
                      borderRadius: '10px', 
                      border: '1px solid var(--border-color)', 
                      background: 'rgba(120, 120, 120, 0.01)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      gap: '12px'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(120, 120, 120, 0.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(120, 120, 120, 0.01)'; }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{trip.tripDate}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {t('followers')}: {trip.followerCount}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge badge-secondary" style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '3px' }}>
                        {t(trip.status)}
                      </span>
                      <ArrowRight size={14} color="var(--text-muted)" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }} />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Trips Pagination */}
            {!loadingTrips && !errorTrips && totalTripsPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setTripsPage(prev => Math.max(prev - 1, 1))} 
                  disabled={tripsPage === 1}
                  style={{ padding: '6px 12px', fontSize: '0.75rem', minWidth: 'auto', margin: 0, height: '28px' }}
                >
                  {t('prev')}
                </button>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {isRTL ? `صفحة ${tripsPage} من ${totalTripsPages}` : `Page ${tripsPage} of ${totalTripsPages}`}
                </span>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setTripsPage(prev => Math.min(prev + 1, totalTripsPages))} 
                  disabled={tripsPage === totalTripsPages}
                  style={{ padding: '6px 12px', fontSize: '0.75rem', minWidth: 'auto', margin: 0, height: '28px' }}
                >
                  {t('next')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Follow Plan Modal */}
      {showFollowModal && (
        <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '32px', position: 'relative', textAlign: isRTL ? 'right' : 'left' }}>
            <button 
              type="button" 
              onClick={() => setShowFollowModal(false)} 
              style={{ position: 'absolute', [isRTL ? 'left' : 'right']: '20px', top: '20px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.25rem', marginBottom: '24px', fontWeight: 700 }}>
              {t('followPlanTitle')} - #{train.trainNumber}
            </h3>

            <form onSubmit={handleSaveFollowPlan}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto', marginBottom: '24px', paddingRight: '4px' }}>
                {dailyConfigs.map((config, index) => {
                  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                  const isEnabled = config.enabled;

                  return (
                    <div 
                      key={index} 
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '110px 110px 1.5fr 70px',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: isEnabled ? 'rgba(99, 102, 241, 0.05)' : 'rgba(120,120,120,0.02)',
                        border: `1px solid ${isEnabled ? 'rgba(99, 102, 241, 0.2)' : 'var(--border-color)'}`,
                        opacity: isEnabled ? 1 : 0.6,
                        transition: 'all 0.2s'
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => {
                            const nextConfigs = [...dailyConfigs];
                            nextConfigs[index].enabled = e.target.checked;
                            setDailyConfigs(nextConfigs);
                          }}
                          style={{ accentColor: 'var(--accent-primary)' }}
                        />
                        <span>{t(dayNames[index]).slice(0, 8)}</span>
                      </label>

                      <select
                        className="input-field"
                        value={config.roleType}
                        onChange={(e) => {
                          const nextConfigs = [...dailyConfigs];
                          nextConfigs[index].roleType = parseInt(e.target.value);
                          setDailyConfigs(nextConfigs);
                        }}
                        disabled={!isEnabled}
                        style={{ height: '36px', padding: '0 8px', fontSize: '0.8rem', cursor: 'pointer', appearance: 'auto', margin: 0 }}
                      >
                        <option value={1}>{t('follower')}</option>
                        <option value={0}>{t('passenger')}</option>
                      </select>

                      <select
                        className="input-field"
                        value={config.targetStopId}
                        onChange={(e) => {
                          const nextConfigs = [...dailyConfigs];
                          nextConfigs[index].targetStopId = e.target.value;
                          setDailyConfigs(nextConfigs);
                        }}
                        disabled={!isEnabled}
                        style={{ height: '36px', padding: '0 8px', fontSize: '0.8rem', cursor: 'pointer', appearance: 'auto', margin: 0 }}
                      >
                        <option value="">-- {t('station')} --</option>
                        {train.routeStops?.map((stop) => (
                          <option key={stop.stopId} value={stop.stopId}>
                            {isRTL ? `${stop.stopNameAr} (${stop.stopCode})` : `${stop.stopNameEn} (${stop.stopCode})`}
                          </option>
                        ))}
                      </select>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          className="input-field"
                          min="1"
                          max="180"
                          value={config.alertLeadTimeMinutes}
                          onChange={(e) => {
                            const nextConfigs = [...dailyConfigs];
                            nextConfigs[index].alertLeadTimeMinutes = parseInt(e.target.value) || 15;
                            setDailyConfigs(nextConfigs);
                          }}
                          disabled={!isEnabled}
                          title={t('alertTiming')}
                          placeholder="mins"
                          style={{ height: '36px', padding: '0 4px', fontSize: '0.8rem', textAlign: 'center', margin: 0 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flexGrow: 1, margin: 0 }}
                  disabled={submittingFollowPlan}
                >
                  {submittingFollowPlan ? t('loading') : t('saveFollowPlan')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowFollowModal(false)}
                  className="btn btn-secondary"
                  style={{ flexGrow: 1, margin: 0 }}
                  disabled={submittingFollowPlan}
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainDetails;
