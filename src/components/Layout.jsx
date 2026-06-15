import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import signalrService from '../services/signalrService';
import { 
  LayoutDashboard, 
  Search as SearchIcon, 
  MapPin, 
  MessageSquare, 
  Lightbulb, 
  User as UserIcon, 
  ShieldAlert, 
  LogOut, 
  AlertTriangle,
  Menu,
  X,
  Sun,
  Moon,
  Globe,
  Bell
} from 'lucide-react';

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { language, toggleLanguage, t, isRTL } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [disruptions, setDisruptions] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    const fetchDisruptions = async () => {
      try {
        const res = await api.getDisruptions();
        if (res.data) {
          setDisruptions(res.data.filter(d => d.isActive));
        }
      } catch (err) {
        console.error('Failed to fetch disruptions:', err);
      }
    };
    fetchDisruptions();
    const interval = setInterval(fetchDisruptions, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileDropdownOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  const fetchNotifications = async () => {
    try {
      const res = await api.getNotifications();
      if (res.data) {
        setNotifications(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    fetchNotifications();

    const initHub = async () => {
      try {
        await signalrService.connect();
      } catch (err) {
        console.error('SignalR connection failed:', err);
      }
    };
    initHub();

    const unsubscribe = signalrService.registerNotificationListener((newNotification) => {
      setNotifications((prev) => [newNotification, ...prev]);
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Handle clicking outside to close dropdowns
  useEffect(() => {
    if (!profileDropdownOpen && !notificationsOpen) return;
    
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.user-menu-container') && !e.target.closest('.notifications-menu-container')) {
        setProfileDropdownOpen(false);
        setNotificationsOpen(false);
      }
    };
    
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [profileDropdownOpen, notificationsOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: t('home'), icon: LayoutDashboard },
    { path: '/search', label: t('searchTrains'), icon: SearchIcon },
    { path: '/lost-found', label: t('lostFound'), icon: MessageSquare },
    { path: '/suggestions', label: t('suggestions'), icon: Lightbulb },
  ];

  const isAdmin = user && (user.role === 1 || user.role === 'Admin');
  if (isAdmin) {
    navItems.push({ path: 'http://localhost:5174/', label: t('adminPanel'), icon: ShieldAlert, external: true });
  }

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <div className="app-container">
      {/* Top Navigation Bar */}
      <header className="top-navbar">
        {/* Brand Logo */}
        <div className="navbar-brand" onClick={() => navigate('/')}>
          <img 
            src={isDark ? "/logo-light.png" : "/logo-dark.png"} 
            alt="WITT logo" 
            style={{ width: '50px', height: '50px', objectFit: 'contain' }} 
          />
          <span>{t('appName')}</span>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="navbar-menu">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path} className={`navbar-item ${isActive ? 'active' : ''}`}>
                {item.external ? (
                  <a href={item.path} target="_blank" rel="noopener noreferrer">
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </a>
                ) : (
                  <Link to={item.path}>
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </nav>

        {/* Action Controls & User Dropdown */}
        <div className="navbar-actions">
          {/* Theme Switcher */}
          <button 
            onClick={toggleTheme} 
            className="navbar-btn" 
            title={t('Toggle Theme')}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Language Switcher */}
          <button 
            onClick={toggleLanguage} 
            className="navbar-btn lang-btn" 
            title={t('Change Language')}
          >
            {language === 'en' ? 'AR' : 'EN'}
          </button>

          {/* Notifications Dropdown (between language switcher and profile) */}
          {user && (
            <div className="notifications-menu-container" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setNotificationsOpen(!notificationsOpen);
                  setProfileDropdownOpen(false);
                }} 
                className="navbar-btn" 
                title={t('Notifications')}
                style={{ position: 'relative' }}
              >
                <Bell size={18} />
                {notifications.filter(n => !n.isRead).length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    boxShadow: '0 0 6px #ef4444'
                  }}></span>
                )}
              </button>

              {notificationsOpen && (
                <div 
                  className="notifications-dropdown glass-panel" 
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: isRTL ? 'auto' : '0',
                    left: isRTL ? '0' : 'auto',
                    marginTop: '8px',
                    width: '320px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-lg)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {t('notifications') || 'Notifications'}
                    </span>
                    {notifications.filter(n => !n.isRead).length > 0 && (
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await api.markAllNotificationsAsRead();
                            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                          } catch (err) {
                            console.error('Failed to mark all as read:', err);
                          }
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        {t('markAllRead') || 'Mark all read'}
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {t('noNotifications') || 'No notifications yet'}
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div 
                          key={n.id} 
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              if (!n.isRead) {
                                await api.markNotificationAsRead(n.id);
                                setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, isRead: true } : item));
                              }
                              setNotificationsOpen(false);
                              if (n.link) {
                                navigate(n.link);
                              }
                            } catch (err) {
                              console.error('Failed to process notification click:', err);
                            }
                          }}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: n.isRead ? 'transparent' : 'rgba(99, 102, 241, 0.05)',
                            borderLeft: n.isRead ? 'none' : '3px solid var(--accent-primary)',
                            cursor: 'pointer',
                            transition: 'background 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            textAlign: isRTL ? 'right' : 'left'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = n.isRead ? 'transparent' : 'rgba(99, 102, 241, 0.05)'; }}
                        >
                          <span style={{ fontSize: '0.8rem', color: n.isRead ? 'var(--text-secondary)' : 'var(--text-primary)', fontWeight: n.isRead ? 400 : 600 }}>
                            {n.message}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            {n.createdAt && !isNaN(new Date(n.createdAt).getTime()) 
                              ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : ''}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Desktop User profile dropdown */}
          {user && (
            <div className="user-menu-container desktop-only">
              <div 
                className="user-profile-trigger" 
                onClick={(e) => {
                  e.stopPropagation();
                  setProfileDropdownOpen(!profileDropdownOpen);
                }}
              >
                {user.avatarUrl ? (
                  <img src={api.resolveImageUrl(user.avatarUrl)} alt={user.displayName} className="navbar-avatar" style={{ objectFit: 'cover' }} />
                ) : (
                  <div className="navbar-avatar">
                    {getInitials(user.displayName)}
                  </div>
                )}
                <span className="navbar-username">{user.displayName}</span>
              </div>

              {profileDropdownOpen && (
                <div className="profile-dropdown glass-panel">
                  <div className="dropdown-user-info">
                    <span className="dropdown-name">{user.displayName}</span>
                    <span className="dropdown-role">{isAdmin ? t('adminPanel') : t('following')}</span>
                  </div>
                  <Link to="/profile" className="dropdown-link">
                    <UserIcon size={16} />
                    <span>{t('myProfile')}</span>
                  </Link>
                  <button 
                    onClick={handleLogout} 
                    className="dropdown-logout"
                  >
                    <LogOut size={16} />
                    <span>{t('signOut')}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mobile hamburger menu toggle */}
          <button 
            className="navbar-btn mobile-header-toggle" 
            style={{ display: 'none' }}
            onClick={(e) => {
              e.stopPropagation();
              setMobileMenuOpen(!mobileMenuOpen);
            }}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Slide-down Overlay Panel */}
      {mobileMenuOpen && (
        <div className="mobile-nav-panel">
          <ul className="mobile-menu-links">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path} className={`mobile-nav-item ${isActive ? 'active' : ''}`}>
                  {item.external ? (
                    <a href={item.path} target="_blank" rel="noopener noreferrer">
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </a>
                  ) : (
                    <Link to={item.path}>
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </Link>
                  )}
                </li>
              );
            })}
            {user && (
              <li className={`mobile-nav-item ${location.pathname === '/profile' ? 'active' : ''}`}>
                <Link to="/profile">
                  <UserIcon size={18} />
                  <span>{t('myProfile')}</span>
                </Link>
              </li>
            )}
          </ul>

          {user && (
            <>
              <div className="mobile-user-block">
                {user.avatarUrl ? (
                  <img src={api.resolveImageUrl(user.avatarUrl)} alt={user.displayName} className="navbar-avatar" style={{ objectFit: 'cover' }} />
                ) : (
                  <div className="navbar-avatar">
                    {getInitials(user.displayName)}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user.displayName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {isAdmin ? t('adminPanel') : t('following')}
                  </div>
                </div>
              </div>

              <button onClick={handleLogout} className="mobile-logout-btn">
                <LogOut size={16} />
                <span>{t('signOut')}</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <main className="main-content">
        {/* Active Service Disruptions Alert Ticker */}
        {disruptions.length > 0 && (
          <div className="disruption-banner animate-fade" style={{ marginTop: '0px' }}>
            <span className="disruption-badge">Alert</span>
            <div className="disruption-ticker">
              <div className="disruption-marquee" style={{ display: 'inline-block', paddingLeft: '100%', animation: 'marquee 25s linear infinite' }}>
                {disruptions.map((disruption, idx) => (
                  <span key={disruption.id} style={{ marginRight: '50px' }}>
                    <AlertTriangle size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom', color: 'var(--warning)' }} />
                    <strong>{isRTL ? disruption.titleAr : disruption.titleEn} (Line {disruption.affectedLine || 'All'}):</strong> {isRTL ? disruption.descriptionAr : disruption.descriptionEn}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: '0px' }}>
          {children}
        </div>
      </main>

      <style>{`
        @keyframes marquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-100%, 0, 0); }
        }
        .disruption-ticker {
          overflow: hidden;
          white-space: nowrap;
          width: 100%;
        }
        .disruption-marquee {
          display: inline-block;
          white-space: nowrap;
        }
        @media (max-width: 768px) {
          .mobile-header-toggle {
            display: flex !important;
          }
          .desktop-only {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Layout;
