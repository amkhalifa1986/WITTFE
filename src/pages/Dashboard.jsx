import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import signalrService from '../services/signalrService';
import { useLanguage } from '../context/LanguageContext';
import { AdInterstitial } from '../components/AdInterstitial';
import { 
  Users, 
  Train, 
  Activity, 
  MessageSquare, 
  ArrowRight, 
  Search, 
  Lightbulb, 
  PlusCircle, 
  MapPin, 
  Info,
  Clock,
  ExternalLink,
  Calendar
} from 'lucide-react';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  
  const [stats, setStats] = useState(null);
  const [followedTrips, setFollowedTrips] = useState([]);
  const [todayTrips, setTodayTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    try {
      setError('');
      const [statsRes, followedRes, todayRes] = await Promise.all([
        api.getDashboardStats(),
        api.getFollowedTrips(),
        api.getTodayTrips()
      ]);
      setStats(statsRes.data);
      setFollowedTrips(followedRes.data || []);
      setTodayTrips(todayRes.data || []);
    } catch (err) {
      console.error(err);
      setError(t('Failed to load home page data. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Register SignalR update listener to dynamically update recent feed
    const unsubscribe = signalrService.registerListener((update) => {
      setStats((prevStats) => {
        if (!prevStats) return null;
        if (prevStats.recentUpdates?.some(u => u.id === update.id)) return prevStats;
        
        return {
          ...prevStats,
          totalLiveUpdatesToday: prevStats.totalLiveUpdatesToday + 1,
          recentUpdates: [update, ...(prevStats.recentUpdates || [])].slice(0, 10)
        };
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'ontime':
      case 'scheduled':
      case 'arrived':
        return 'badge-on-time';
      case 'delayed':
      case 'intransit':
      case 'departed':
        return 'badge-delayed';
      case 'cancelled':
        return 'badge-cancelled';
      default:
        return 'badge-info';
    }
  };

  const getStatusTagStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'ontime':
      case 'scheduled':
        return { background: '#3b82f6', color: '#000000', border: '1px solid #3b82f6', fontWeight: '600' };
      case 'delayed':
      case 'intransit':
      case 'departed':
        return { background: '#ef4444', color: '#ffffff', border: '1px solid #ef4444' };
      case 'cancelled':
        return { background: '#374151', color: '#ffffff', border: '1px solid #374151' };
      case 'arrived':
      case 'completed':
      case 'ended':
      case 'atstation':
        return { background: '#9ca3af', color: '#000000', border: '1px solid #9ca3af' };
      default:
        return { background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' };
    }
  };

  const getCrowdBadge = (crowd) => {
    if (!crowd) return null;
    let customStyle = { background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' };
    switch (crowd?.toLowerCase()) {
      case 'aislecrowded':
      case 'crowded':
        customStyle = { background: '#ef4444', color: '#ffffff', border: '1px solid #ef4444' };
        break;
      case 'fullchairs':
        customStyle = { background: '#9ca3af', color: '#000000', border: '1px solid #9ca3af' };
        break;
      case 'emptychairs':
      case 'empty':
        customStyle = { background: '#10b981', color: '#000000', border: '1px solid #10b981' };
        break;
    }
    return (
      <span className="badge" style={{ fontSize: '0.7rem', padding: '2px 8px', ...customStyle }}>
        {t(crowd)}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <Clock className="animate-spin" size={32} color="var(--accent-primary)" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <AdInterstitial pageKey="dashboard" />
      {/* Page Header 
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{t('home')}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>{t('welcomeSub')}</p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/search" className="btn btn-secondary" style={{ padding: '10px 18px', fontSize: '0.875rem' }}>
            <Search size={16} /> {t('searchTrains')}
          </Link>
          <Link to="/lost-found" className="btn btn-secondary" style={{ padding: '10px 18px', fontSize: '0.875rem' }}>
            <PlusCircle size={16} /> {t('lostFound')}
          </Link>
        </div>
      </div>
*/}
      {error && (
        <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--danger)', padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={fetchDashboardData} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Retry</button>
        </div>
      )}

      {/* About the System Banner 
      <div className="glass-panel animate-fade" style={{ padding: '32px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(6, 182, 212, 0.05) 100%)', display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '14px',
          background: 'rgba(99, 102, 241, 0.2)',
          color: 'var(--accent-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Info size={28} />
        </div>
        <div style={{ flexGrow: 1, minWidth: '280px' }}>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '8px' }}>{t('systemAboutTitle')}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
            {t('systemAboutDesc')}
          </p>
        </div>
      </div>*/}

      {/* Stats Cards Grid */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '12px', borderRadius: '10px' }}>
              <Users size={24} color="#6366f1" />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('statUsers')}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.totalUsers ?? 0}</div>
            </div>
          </div>

          <div className="stat-card glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(72, 187, 120, 0.1)', padding: '12px', borderRadius: '10px' }}>
              <Train size={24} color="#48bb78" />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('statTrains')}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.totalTrains ?? 0}</div>
            </div>
          </div>

          <div className="stat-card glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(237, 137, 54, 0.1)', padding: '12px', borderRadius: '10px' }}>
              <Calendar size={24} color="#ed8936" />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('pendingTripsToday') || t('statTrips')}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.pendingTripsToday ?? 0}</div>
            </div>
          </div>

          <div className="stat-card glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(56, 178, 172, 0.1)', padding: '12px', borderRadius: '10px' }}>
              <Activity size={24} color="#38b2ac" />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('runningTripsToday') || t('statTrips')}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.runningTripsToday ?? 0}</div>
            </div>
          </div>

          <div className="stat-card glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(159, 122, 234, 0.1)', padding: '12px', borderRadius: '10px' }}>
              <MessageSquare size={24} color="#9f7aea" />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('statUpdates')}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.totalLiveUpdatesToday ?? 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Split Layout Grid */}
      <div className="dashboard-grid">
        {/* Left Column: Today's Active Trips & Followed Trips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Today's Active Trips Panel */}
          <div className="glass-panel" style={{ minHeight: '300px' }}>
            <div className="panel-header">
              <h3><Activity size={20} color="var(--accent-secondary)" /> {t('todayTrips')}</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{todayTrips.length} {t('active')}</span>
            </div>
            <div className="panel-body" style={{ padding: '12px 0' }}>
              {todayTrips.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <Train size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
                  <p style={{ fontSize: '0.9rem' }}>{t('noActiveTrips')}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {todayTrips.map((trip) => (
                    <div 
                      key={trip.id} 
                      onClick={() => navigate(`/trip/${trip.id}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 24px',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(120, 120, 120, 0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '8px',
                          background: 'rgba(6, 182, 212, 0.1)',
                          color: 'var(--accent-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontFamily: 'Outfit'
                        }}>
                          {trip.trainNumber}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                            {isRTL ? trip.trainNameAr : trip.trainNameEn}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span>{t('trackDate')}: {trip.tripDate}</span>
                            <span>•</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Users size={10} /> {trip.followerCount}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span className={`badge ${getStatusBadgeClass(trip.status)}`} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                          {t(trip.status)}
                        </span>
                        <div style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          {t('trackLive')} <ExternalLink size={12} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Followed Trips Panel */}
          <div className="glass-panel">
            <div className="panel-header">
              <h3><Train size={20} color="var(--accent-primary)" /> {t('followedTrains')}</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{followedTrips.length}</span>
            </div>
            <div className="panel-body" style={{ padding: '12px 0' }}>
              {followedTrips.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '0.85rem' }}>{t('noFollowedTrips')}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {followedTrips.map((trip) => (
                    <div 
                      key={trip.id} 
                      onClick={() => navigate(`/trip/${trip.id}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 24px',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(120, 120, 120, 0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '8px',
                          background: 'rgba(99, 102, 241, 0.1)',
                          color: 'var(--accent-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontFamily: 'Outfit'
                        }}>
                          {trip.trainNumber}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                            {isRTL ? trip.trainNameAr : trip.trainNameEn}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span>{t('myStatus')}: <strong>{t(trip.personalStatus)}</strong></span>
                          </div>
                        </div>
                      </div>

                      <ArrowRight size={16} color="var(--text-muted)" style={{ transform: isRTL ? 'rotate(180deg)' : undefined }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Community Updates Feed */}
        <div className="glass-panel" style={{ minHeight: '400px' }}>
          <div className="panel-header">
            <h3><MessageSquare size={20} color="var(--accent-secondary)" /> {t('liveFeed')}</h3>
          </div>
          <div className="panel-body">
            {!stats || !stats.recentUpdates || stats.recentUpdates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                <MessageSquare size={36} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p style={{ fontSize: '0.85rem' }}>{t('noUpdatesFeed')}</p>
              </div>
            ) : (
              <div className="update-feed">
                {stats.recentUpdates.map((update) => (
                  <div key={update.id} className="feed-item">
                    <div className="feed-header">
                      <div className="feed-author">
                        <div className="feed-avatar">
                          {update.authorName ? update.authorName[0].toUpperCase() : 'P'}
                        </div>
                        <div>
                          <div className="feed-name">{update.authorName}</div>
                          {update.trainNumber && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 500 }}>
                              {t('statTrains')} {update.trainNumber}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="feed-time">
                        {update.createdAt && !isNaN(new Date(update.createdAt).getTime()) 
                          ? new Date(update.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </div>

                    <div className="feed-content">
                      {update.content}
                    </div>

                    <div className="feed-meta">
                      {update.statusTag && (
                        <span className="badge" style={{ fontSize: '0.65rem', padding: '1px 6px', ...getStatusTagStyle(update.statusTag) }}>
                          {t(update.statusTag)}
                        </span>
                      )}
                      {getCrowdBadge(update.crowdState)}
                      {update.latitude && update.longitude && (
                        <span className="badge" style={{ background: 'rgba(120,120,120,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', fontSize: '0.65rem', padding: '1px 6px' }}>
                          <MapPin size={8} style={{ display: 'inline', marginRight: '3px' }} /> {t('gpsMapPin')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
