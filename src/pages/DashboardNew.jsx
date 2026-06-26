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
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export const DashboardNew = () => {
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  
  const [stats, setStats] = useState(null);
  const [followedTrips, setFollowedTrips] = useState([]);
  const [todayTrips, setTodayTrips] = useState([]);
  const [galleryItems, setGalleryItems] = useState([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // filter to show either all today trips or only those the user follows
  const [showFollowedOnly, setShowFollowedOnly] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setError('');
      const [statsRes, followedRes, todayRes, galleryRes] = await Promise.all([
        api.getDashboardStats(),
        api.getFollowedTrips(),
        api.getTodayTrips(),
        api.getGalleryItems()
      ]);
      setStats(statsRes.data);
      setFollowedTrips(followedRes.data || []);
      setGalleryItems(galleryRes.data || galleryRes || []);
      // Sort by scheduledDeparture (first stop) ascending so earliest trips appear first
      const sorted = (todayRes.data || []).slice().sort((a, b) => {
        const ta = a.scheduledDeparture || '99:99:99';
        const tb = b.scheduledDeparture || '99:99:99';
        return ta.localeCompare(tb);
      });
      setTodayTrips(sorted);
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

  const defaultSlides = [
    {
      id: 'default-1',
      imagePath: '/hero-banner.png',
      captionEn: 'Real-Time Train Tracking Platform',
      captionAr: 'منصة تتبع وحركة القطارات المباشرة',
      isVisible: true
    },
    {
      id: 'default-2',
      imagePath: '/scenic-route.png',
      captionEn: 'Explore Scenic Passenger Routes',
      captionAr: 'استكشف مسارات الرحلات الطبيعية للقطارات',
      isVisible: true
    }
  ];

  const slides = galleryItems.filter(g => g.isVisible).length > 0
    ? galleryItems.filter(g => g.isVisible)
    : defaultSlides;

  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSlideIndex(prev => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides]);

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
      <div className="dashboard-grid-container">
        {/* Row 1, Column 1: Gallery Slideshow */}
        <div className="gallery-container-cell glass-panel" style={{ padding: 0, overflow: 'hidden', height: '450px', position: 'relative' }}>
          {slides.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              No images available
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
              {/* Slides */}
              {slides.map((slide, idx) => {
                if (Math.abs(idx - activeSlideIndex) > 1 && !(idx === 0 && activeSlideIndex === slides.length - 1) && !(idx === slides.length - 1 && activeSlideIndex === 0)) return null;
                return (
                <div
                  key={slide.id || idx}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: idx === activeSlideIndex ? 1 : 0,
                    transition: 'opacity 0.8s ease-in-out',
                    zIndex: idx === activeSlideIndex ? 1 : 0,
                    pointerEvents: idx === activeSlideIndex ? 'auto' : 'none',
                    background: '#000',
                    overflow: 'hidden'
                  }}
                >
                  {/* Blurred Background Copy */}
                  <img
                    src={api.resolveImageUrl(slide.imagePath)}
                    alt=""
                    loading={idx === 0 ? "eager" : "lazy"}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      filter: 'blur(16px) scale(1.15)',
                      opacity: 0.8,
                      zIndex: 1
                    }}
                  />
                  {/* 80% Black Tint Overlay */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0, 0, 0, 0.8)',
                    zIndex: 2
                  }} />

                  {/* Foreground Exact Fit Image */}
                  <img
                    src={api.resolveImageUrl(slide.imagePath)}
                    alt={isRTL ? slide.captionAr : slide.captionEn}
                    loading={idx === 0 ? "eager" : "lazy"}
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      zIndex: 3
                    }}
                  />

                  {/* Caption Overlay */}
                  {(slide.captionEn || slide.captionAr) && (
                    slide.link ? (
                      <a
                        href={slide.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          padding: '24px',
                          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.4) 60%, rgba(0, 0, 0, 0) 100%)',
                          backdropFilter: 'blur(4px)',
                          WebkitBackdropFilter: 'blur(4px)',
                          color: '#ffffff',
                          textAlign: isRTL ? 'right' : 'left',
                          direction: isRTL ? 'rtl' : 'ltr',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '16px',
                          zIndex: 4,
                          textDecoration: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <p style={{
                          fontSize: '1.05rem',
                          fontWeight: 700,
                          margin: 0,
                          textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                          letterSpacing: isRTL ? '0' : '0.5px'
                        }}>
                          {isRTL ? slide.captionAr : slide.captionEn}
                        </p>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'var(--accent-gradient)',
                          color: '#ffffff',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}>
                          {isRTL ? 'عرض التفاصيل' : 'View details'}
                          <ArrowRight size={14} style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }} />
                        </span>
                      </a>
                    ) : (
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: '24px',
                        background: 'linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.4) 60%, rgba(0, 0, 0, 0) 100%)',
                        backdropFilter: 'blur(4px)',
                        WebkitBackdropFilter: 'blur(4px)',
                        color: '#ffffff',
                        textAlign: isRTL ? 'right' : 'left',
                        direction: isRTL ? 'rtl' : 'ltr',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        zIndex: 4
                      }}>
                        <p style={{
                          fontSize: '1.05rem',
                          fontWeight: 700,
                          margin: 0,
                          textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                          letterSpacing: isRTL ? '0' : '0.5px'
                        }}>
                          {isRTL ? slide.captionAr : slide.captionEn}
                        </p>
                      </div>
                    )
                  )}
                </div>
              )})}

              {/* Navigation Arrows */}
              {slides.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSlideIndex(prev => (prev - 1 + slides.length) % slides.length);
                    }}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      [isRTL ? 'right' : 'left']: '16px',
                      transform: 'translateY(-50%)',
                      zIndex: 10,
                      background: 'rgba(0, 0, 0, 0.4)',
                      backdropFilter: 'blur(4px)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#ffffff',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.8)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)'; }}
                  >
                    <ChevronLeft size={20} style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSlideIndex(prev => (prev + 1) % slides.length);
                    }}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      [isRTL ? 'left' : 'right']: '16px',
                      transform: 'translateY(-50%)',
                      zIndex: 10,
                      background: 'rgba(0, 0, 0, 0.4)',
                      backdropFilter: 'blur(4px)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#ffffff',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.8)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)'; }}
                  >
                    <ChevronRight size={20} style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }} />
                  </button>
                </>
              )}

              {/* Indicator Dots */}
              {slides.length > 1 && (
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: '8px',
                  zIndex: 10
                }}>
                  {slides.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSlideIndex(idx);
                      }}
                      style={{
                        width: idx === activeSlideIndex ? '24px' : '8px',
                        height: '8px',
                        borderRadius: '4px',
                        background: idx === activeSlideIndex ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.4)',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'all 0.3s ease',
                        outline: 'none'
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Row 2, Column 1: Live Updates Feed */}
        <div className="live-feed-container-cell glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '350px', overflow: 'hidden' }}>
          <div className="panel-header" style={{ 
            flexShrink: 0, 
            padding: '20px 24px', 
            borderBottom: '1px solid var(--border-color)', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            flexDirection: isRTL ? 'row-reverse' : 'row'
          }}>
            <MessageSquare size={20} color="var(--accent-secondary)" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, textAlign: isRTL ? 'right' : 'left', width: '100%' }}>{t('liveFeed')}</h3>
          </div>
          <div className="panel-body" style={{ flexGrow: 1, overflowY: 'auto', padding: '16px 24px' }}>
            {!stats || !stats.recentUpdates || stats.recentUpdates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                <MessageSquare size={36} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p style={{ fontSize: '0.85rem', margin: 0 }}>{t('noUpdatesFeed')}</p>
              </div>
            ) : (
              <div className="update-feed" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {stats.recentUpdates.map((update) => (
                  <div key={update.id} className="feed-item" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                    <div className="feed-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div className="feed-author" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="feed-avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem' }}>
                          {update.authorName ? update.authorName[0].toUpperCase() : 'P'}
                        </div>
                        <div>
                          <div className="feed-name" style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{update.authorName}</div>
                          {update.trainNumber && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 500 }}>
                              {t('statTrains')} {update.trainNumber}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="feed-time" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {update.createdAt && !isNaN(new Date(update.createdAt).getTime()) 
                          ? new Date(update.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </div>

                    <div className="feed-content" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '8px' }}>
                      {update.content}
                    </div>

                    <div className="feed-meta" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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

        {/* Row 1 & 2, Column 2: Today's Active Trips Panel */}
        <div className="active-trips-container-cell glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '832px', overflow: 'hidden' }}>
          <div className="panel-header" style={{ flexShrink: 0, padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} color="var(--accent-secondary)" />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{t('todayTrips')}</h3>
              <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)', border: 'none' }}>
                {todayTrips.length} {t('active')}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                className="btn btn-sm" 
                onClick={() => setShowFollowedOnly(false)} 
                disabled={!showFollowedOnly}
                style={{ padding: '4px 8px', fontSize: '0.75rem', margin: 0 }}
              >
                {t('All')}
              </button>
              <button 
                className="btn btn-sm" 
                onClick={() => setShowFollowedOnly(true)} 
                disabled={showFollowedOnly}
                style={{ padding: '4px 8px', fontSize: '0.75rem', margin: 0 }}
              >
                {t('Followed')}
              </button>
            </div>
          </div>
          <div className="panel-body" style={{ flexGrow: 1, overflowY: 'auto', padding: '12px 0' }}>
            {todayTrips.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Train size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p style={{ fontSize: '0.9rem', margin: 0 }}>{t('noActiveTrips')}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {(() => {
                  const tripsToShow = showFollowedOnly
                    ? todayTrips.filter(t => followedTrips.some(f => f.id === t.id))
                    : todayTrips;
                  return tripsToShow.map((trip) => {
                    const isFollowed = followedTrips.some(f => f.id === trip.id);
                    const badgeStyle = {
                      position: 'absolute',
                      top: 0,
                      width: 14,
                      height: 14,
                      backgroundColor: '#f97316',
                      ...(isRTL
                        ? { right: 0, borderBottomLeftRadius: 14 }
                        : { left: 0, borderBottomRightRadius: 14 })
                    };
                    return (
                      <div 
                        key={trip.id}
                        onClick={() => navigate(`/trip/${trip.id}`)}
                        style={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '16px 24px',
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(120, 120, 120, 0.02)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        {isFollowed && <div style={badgeStyle} />}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{
                            minWidth: '38px',
                            height: '38px',
                            borderRadius: '8px',
                            background: 'rgba(6, 182, 212, 0.1)',
                            color: 'var(--accent-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontFamily: 'Outfit',
                            padding: '0 8px',
                            fontSize: '0.85rem',
                            whiteSpace: 'nowrap',
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
                          <span 
                            className="badge" 
                            style={{
                              fontSize: '0.65rem', 
                              padding: '2px 8px',
                              backgroundColor: trip.statusDetails?.color ? `${trip.statusDetails.color}20` : 'var(--info-glow)',
                              color: trip.statusDetails?.color || 'var(--info)',
                              borderColor: trip.statusDetails?.color ? `${trip.statusDetails.color}40` : 'rgba(59, 130, 246, 0.3)',
                              borderWidth: '1px',
                              borderStyle: 'solid'
                            }}
                          >
                            {isRTL 
                              ? (trip.statusDetails?.nameAr || trip.status) 
                              : (trip.statusDetails?.nameEn || trip.status)}
                          </span>
                          <div style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                            {t('trackLive')} <ExternalLink size={12} />
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>
      </div>


    </div>
  );
};

export default DashboardNew;
