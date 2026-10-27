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
  ChevronRight,
  Trophy,
  Star,
  Medal,
  X,
  MoreHorizontal
} from 'lucide-react';
import { useAuth } from '../context/authContext';

export const DashboardNew = () => {
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  const { user } = useAuth();
  
  const [stats, setStats] = useState(null);
  const [followedTrips, setFollowedTrips] = useState([]);
  const [todayTrips, setTodayTrips] = useState([]);
  const [galleryItems, setGalleryItems] = useState([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // filter to show either all today trips or only those the user follows
  const [showFollowedOnly, setShowFollowedOnly] = useState(false);
  const [showMonthlyModal, setShowMonthlyModal] = useState(false);
  const [monthlyParticipants, setMonthlyParticipants] = useState([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  const openMonthlyModal = async () => {
    try {
      setLoadingMonthly(true);
      setShowMonthlyModal(true);
      setMonthlyParticipants([]);
      const now = new Date();
      const res = await api.getMonthlyLeaderboard(now.getFullYear(), now.getMonth() + 1);
      if (res.isSuccess && res.data) {
        setMonthlyParticipants(res.data);
      }
    } catch (err) {
      console.error("Failed to load monthly leaderboard:", err);
    } finally {
      setLoadingMonthly(false);
    }
  };
  // date filter: 'today' | 'yesterday'
  const [dateFilter, setDateFilter] = useState('today');

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
      <div className="glass-panel animate-fade" style={{ padding: '32px', background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 15%, transparent) 0%, color-mix(in srgb, var(--accent-secondary) 5%, transparent) 100%)', display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '14px',
          background: 'color-mix(in srgb, var(--accent-primary) 20%, transparent)',
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

      {/* Stats Cards & Monthly Points Leaderboard Header */}
      {stats && (
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', width: '100%', alignItems: 'stretch', marginBottom: '24px' }}>
          {/* Stats Cards (60%) */}
          <div style={{ flex: '1 1 58%', minWidth: '350px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'nowrap', height: '100%' }}>
              <div className="stat-card glass-panel" style={{
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-start',
                textAlign: isRTL ? 'right' : 'left',
                gap: '8px',
                flex: '1 1 0px',
                minWidth: '0px'
              }}>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                  {t('statUsers')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)', padding: '6px', borderRadius: '6px', flexShrink: 0 }}>
                    <Users size={16} color="var(--accent-primary)" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: '1' }}>
                    {stats.totalUsers ?? 0}
                  </div>
                </div>
              </div>

              <div className="stat-card glass-panel" style={{
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-start',
                textAlign: isRTL ? 'right' : 'left',
                gap: '8px',
                flex: '1 1 0px',
                minWidth: '0px'
              }}>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                  {t('statTrains')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ background: 'rgba(72, 187, 120, 0.1)', padding: '6px', borderRadius: '6px', flexShrink: 0 }}>
                    <Train size={16} color="#48bb78" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: '1' }}>
                    {stats.totalTrains ?? 0}
                  </div>
                </div>
              </div>

              <div className="stat-card glass-panel" style={{
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-start',
                textAlign: isRTL ? 'right' : 'left',
                gap: '8px',
                flex: '1 1 0px',
                minWidth: '0px'
              }}>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                  {t('pendingTrips')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ background: 'rgba(237, 137, 54, 0.1)', padding: '6px', borderRadius: '6px', flexShrink: 0 }}>
                    <Calendar size={16} color="#ed8936" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: '1' }}>
                    {stats.pendingTripsToday ?? 0}
                  </div>
                </div>
              </div>

              <div className="stat-card glass-panel" style={{
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-start',
                textAlign: isRTL ? 'right' : 'left',
                gap: '8px',
                flex: '1 1 0px',
                minWidth: '0px'
              }}>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                  {t('runningTrips')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ background: 'rgba(56, 178, 172, 0.1)', padding: '6px', borderRadius: '6px', flexShrink: 0 }}>
                    <Activity size={16} color="#38b2ac" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: '1' }}>
                    {stats.runningTripsToday ?? 0}
                  </div>
                </div>
              </div>

              <div className="stat-card glass-panel" style={{
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-start',
                textAlign: isRTL ? 'right' : 'left',
                gap: '8px',
                flex: '1 1 0px',
                minWidth: '0px'
              }}>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                  {t('statUpdates')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ background: 'rgba(159, 122, 234, 0.1)', padding: '6px', borderRadius: '6px', flexShrink: 0 }}>
                    <MessageSquare size={16} color="#9f7aea" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: '1' }}>
                    {stats.totalLiveUpdatesToday ?? 0}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Points Leaderboard (40%) */}
          {stats.monthlyLeaderboard && stats.monthlyLeaderboard.length > 0 && (
            <div className="glass-panel" style={{ flex: '1 1 38%', minWidth: '280px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', position: 'relative' }}>
              {/* More button in the top right corner */}
              <button
                onClick={openMonthlyModal}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: isRTL ? 'auto' : '12px',
                  left: isRTL ? '12px' : 'auto',
                  background: 'rgba(120, 120, 120, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  zIndex: 5,
                  padding: 0
                }}
                title={isRTL ? 'عرض المزيد' : 'Show More'}
                type="button"
              >
                <MoreHorizontal size={14} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <div style={{ background: 'rgba(251, 191, 36, 0.12)', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trophy size={18} color="#f59e0b" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', lineHeight: '1.2' }}>{t('monthlyLeaderboard') || 'Monthly Leaderboard'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.2' }}>{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flexGrow: 1, alignItems: 'center' }}>
                {stats.monthlyLeaderboard.slice(0, 3).map((entry, idx) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={entry.userId} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(120,120,120,0.02)', borderRadius: '10px', padding: '8px 12px', border: '1px solid var(--border-color)', flex: '1 1 auto', justifyContent: 'center' }}>
                      <span style={{ fontSize: '1.25rem' }}>{medals[idx] || `#${entry.rank}`}</span>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--accent-contrast)', fontSize: '0.85rem', flexShrink: 0 }}>
                        {entry.displayName?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.2' }}>{entry.displayName}</span>
                        <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 800, lineHeight: '1.2' }}>{entry.totalPoints} {t('points') || 'pts'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
                          color: 'var(--accent-contrast)',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          boxShadow: '0 4px 12px color-mix(in srgb, var(--accent-primary) 35%, transparent)',
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
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-primary) 80%, transparent)'; }}
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
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-primary) 80%, transparent)'; }}
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
                        <div className="feed-avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem' }}>
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
          <div className="panel-header" style={{ flexShrink: 0, padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} color="var(--accent-secondary)" />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{t('todayTrips')}</h3>
              <span className="badge" style={{ fontSize: '0.65rem', background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)', color: 'var(--accent-primary)', border: 'none' }}>
                {todayTrips.length} {t('active')}
              </span>
            </div>
            {/* All filters in the same line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {/* Follow Filter Group */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  className="btn btn-sm" 
                  onClick={() => setShowFollowedOnly(false)} 
                  disabled={!showFollowedOnly}
                  style={{ padding: '6px 12px', fontSize: '0.95rem', fontWeight: 800, margin: 0,
                    ...(!showFollowedOnly ? { background: 'var(--accent-primary)', color: 'var(--accent-contrast)', borderColor: 'var(--accent-primary)', opacity: 1 } : {}) }}
                >
                  {t('All')}
                </button>
                <button 
                  className="btn btn-sm" 
                  onClick={() => setShowFollowedOnly(true)} 
                  disabled={showFollowedOnly}
                  style={{ padding: '6px 12px', fontSize: '0.95rem', fontWeight: 800, margin: 0,
                    ...(showFollowedOnly ? { background: 'var(--accent-primary)', color: 'var(--accent-contrast)', borderColor: 'var(--accent-primary)', opacity: 1 } : {}) }}
                >
                  {t('Followed')}
                </button>
              </div>

              {/* Vertical divider */}
              <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)' }}></div>

              {/* Date Filter Group */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {['today', 'yesterday'].map(f => (
                  <button
                    key={f}
                    className="btn btn-sm"
                    onClick={() => setDateFilter(f)}
                    disabled={dateFilter === f}
                    style={{ padding: '6px 12px', fontSize: '0.95rem', fontWeight: 800, margin: 0,
                      ...(dateFilter === f ? { background: 'var(--accent-primary)', color: 'var(--accent-contrast)', borderColor: 'var(--accent-primary)', opacity: 1 } : {}) }}
                  >
                    {f === 'today' ? t('today') : t('yesterday')}
                  </button>
                ))}
              </div>
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
                  const getLocalDateString = (d) => {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                  };
                  const today = getLocalDateString(new Date());
                  const yesterday = getLocalDateString(new Date(Date.now() - 86400000));
                  let tripsToShow = dateFilter === 'today'
                    ? todayTrips.filter(tr => tr.tripDate === today)
                    : dateFilter === 'yesterday'
                      ? todayTrips.filter(tr => tr.tripDate === yesterday)
                      : todayTrips;
                  if (showFollowedOnly) tripsToShow = tripsToShow.filter(t => followedTrips.some(f => f.id === t.id));
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
                            background: 'color-mix(in srgb, var(--accent-secondary) 10%, transparent)',
                            color: 'var(--accent-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontFamily: 'Space Grotesk',
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


      {/* Monthly Leaderboard Popup Modal */}
      {showMonthlyModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(8px)',
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '450px',
            padding: '24px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            position: 'relative',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)'
          }}>
            {/* Close Button */}
            <button 
              onClick={() => setShowMonthlyModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(251, 191, 36, 0.12)', padding: '10px', borderRadius: '10px' }}>
                <Trophy size={24} color="#f59e0b" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {isRTL ? 'لوحة صدارة الشهر' : 'Monthly Leaderboard'}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Scrollable list */}
            <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '150px', justifyContent: loadingMonthly ? 'center' : 'flex-start' }}>
              {loadingMonthly ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-secondary)' }}>
                  <div className="spinner" style={{ borderTopColor: 'var(--accent-primary)', width: '32px', height: '32px', margin: '0 auto 12px auto' }}></div>
                  <p style={{ fontSize: '0.85rem', margin: 0 }}>{isRTL ? 'جاري التحميل...' : 'Loading leaderboard...'}</p>
                </div>
              ) : monthlyParticipants.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                  <Trophy size={32} style={{ marginBottom: '12px', opacity: 0.2 }} />
                  <p style={{ fontSize: '0.85rem', margin: 0 }}>{isRTL ? 'لا توجد مشاركات هذا الشهر بعد' : 'No participants this month yet'}</p>
                </div>
              ) : (
                <>
                  {monthlyParticipants.map((entry, idx) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    const isMe = user && user.id === entry.userId;
                    return (
                      <div 
                        key={entry.userId} 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: isMe ? 'color-mix(in srgb, var(--accent-primary) 15%, transparent)' : 'rgba(120, 120, 120, 0.04)',
                          borderRadius: '12px',
                          padding: '12px 16px',
                          border: isMe ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                          boxShadow: isMe ? '0 4px 12px color-mix(in srgb, var(--accent-primary) 20%, transparent)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '1.4rem', fontWeight: 800, minWidth: '24px' }}>
                            {medals[idx] || `#${idx + 1}`}
                          </span>
                          <div style={{
                            width: 36, height: 36,
                            borderRadius: '50%',
                            background: isMe ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, color: '#fff', fontSize: '0.9rem',
                            flexShrink: 0
                          }}>
                            {entry.displayName?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <div style={{
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              color: isMe ? 'var(--accent-primary)' : 'var(--text-primary)'
                            }}>
                              {entry.displayName} {isMe && `(${isRTL ? 'أنت' : 'You'})`}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {entry.rank === 1 ? (isRTL ? 'المركز الأول' : '1st Place') : 
                               entry.rank === 2 ? (isRTL ? 'المركز الثاني' : '2nd Place') :
                               entry.rank === 3 ? (isRTL ? 'المركز الثالث' : '3rd Place') :
                               `${entry.rank}${isRTL ? '' : 'th'} ${isRTL ? 'المركز' : 'Place'}`}
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '1rem', color: '#f59e0b', fontWeight: 800 }}>
                          {entry.totalPoints} {t('points')}
                        </span>
                      </div>
                    );
                  })}

                  {/* Encouragement message if user is not in top list */}
                  {user && !monthlyParticipants.some(p => p.userId === user.id) && (
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px dashed rgba(245, 158, 11, 0.3)',
                      borderRadius: '12px',
                      padding: '16px',
                      textAlign: 'center',
                      marginTop: '12px'
                    }}>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#d97706', fontWeight: 600, lineHeight: '1.5' }}>
                        {isRTL 
                          ? '😊 لم تسجل نقاطاً كافية لتظهر في الصدارة بعد! تفاعل بمشاركة تحديثات الرحلات لتكسب نقاطك وتظهر اسمك هنا!'
                          : "😊 You haven't earned enough points to join the top leaderboard yet! Participate by sharing updates to claim your spot!"}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowMonthlyModal(false)}
                style={{ padding: '8px 18px', fontSize: '0.9rem' }}
              >
                {isRTL ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardNew;
