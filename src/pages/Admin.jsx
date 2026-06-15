import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { 
  Users, 
  Lightbulb, 
  AlertTriangle, 
  Upload, 
  Clock, 
  UserMinus, 
  UserCheck, 
  Shield, 
  Check, 
  X,
  FileSpreadsheet,
  Settings,
  LayoutDashboard
} from 'lucide-react';
import { DashboardMapAndFeed } from './DashboardMapAndFeed';

export const Admin = () => {
  const { t, isRTL } = useLanguage();
  
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'users', 'suggestions', 'disruptions', 'import', 'settings'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Tab States
  const [statsData, setStatsData] = useState(null);

  // Tab States
  const [usersList, setUsersList] = useState([]);
  const [suggestionsList, setSuggestionsList] = useState([]);
  const [disruptionsList, setDisruptionsList] = useState([]);
  const [pendingUpdates, setPendingUpdates] = useState([]);
  const [removalRequests, setRemovalRequests] = useState([]);

  // Disruption Form State
  const [dispTitleEn, setDispTitleEn] = useState('');
  const [dispTitleAr, setDispTitleAr] = useState('');
  const [dispDescEn, setDispDescEn] = useState('');
  const [dispDescAr, setDispDescAr] = useState('');
  const [dispLine, setDispLine] = useState('');
  const [submittingDisruption, setSubmittingDisruption] = useState(false);

  // Suggestion Review Modal State
  const [reviewingSug, setReviewingSug] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // System Settings State
  const [systemSettings, setSystemSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // CSV Import State
  const [stopsCsv, setStopsCsv] = useState('');
  const [trainsCsv, setTrainsCsv] = useState('');
  const [importingStops, setImportingStops] = useState(false);
  const [importingTrains, setImportingTrains] = useState(false);

  // Track Geometries State
  const [trainsList, setTrainsList] = useState([]);
  const [selectedTrainId, setSelectedTrainId] = useState('');
  const [trackGeoJson, setTrackGeoJson] = useState('');
  const [uploadingTrack, setUploadingTrack] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (activeTab === 'dashboard') {
        const res = await api.getDashboardStats();
        setStatsData(res.data || null);
      } else if (activeTab === 'users') {
        const res = await api.adminGetUsers();
        setUsersList(res.data || []);
      } else if (activeTab === 'suggestions') {
        const res = await api.adminGetPendingSuggestions();
        setSuggestionsList(res.data || []);
      } else if (activeTab === 'disruptions') {
        const res = await api.getDisruptions();
        setDisruptionsList(res.data || []);
      } else if (activeTab === 'tracks') {
        const res = await api.adminGetTrains();
        setTrainsList(res.data || []);
      } else if (activeTab === 'updates') {
        const pendingRes = await api.adminGetPendingLiveUpdates();
        const removalRes = await api.adminGetLiveUpdateRemovalRequests();
        setPendingUpdates(pendingRes.data || []);
        setRemovalRequests(removalRes.data || []);
      } else if (activeTab === 'settings') {
        const res = await api.adminGetSystemSettings();
        setSystemSettings(res.data || res);
      }
    } catch (err) {
      console.error(err);
      setError(t('Failed to fetch admin data: ') + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleToggleSuspend = async (userId, isCurrentlySuspended) => {
    try {
      await api.adminToggleUserSuspension(userId, !isCurrentlySuspended);
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, isSuspended: !isCurrentlySuspended } : u));
      setSuccess(`User successfully ${!isCurrentlySuspended ? 'suspended' : 'unsuspended'}.`);
    } catch (err) {
      alert('Error updating user suspension: ' + err.message);
    }
  };

  const handleChangeRole = async (userId, currentRole) => {
    const nextRole = currentRole === 'Admin' || currentRole === 1 ? 0 : 1;
    const nextRoleName = nextRole === 1 ? 'Admin' : 'User';
    if (!window.confirm(`Change this user's role to ${nextRoleName}?`)) return;

    try {
      await api.adminChangeUserRole(userId, nextRole);
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, role: nextRoleName } : u));
      setSuccess(`User role changed to ${nextRoleName}.`);
    } catch (err) {
      alert('Error changing user role: ' + err.message);
    }
  };

  const handleCreateDisruption = async (e) => {
    e.preventDefault();
    if (!dispTitleEn.trim() || !dispDescEn.trim()) return;

    setSubmittingDisruption(true);
    setError('');
    setSuccess('');

    try {
      await api.adminCreateDisruption(
        dispTitleAr.trim() || dispTitleEn.trim(),
        dispTitleEn.trim(),
        dispDescAr.trim() || dispDescEn.trim(),
        dispDescEn.trim(),
        dispLine.trim() || null
      );
      setSuccess(t('Service disruption alert created.'));
      setDispTitleEn('');
      setDispTitleAr('');
      setDispDescEn('');
      setDispDescAr('');
      setDispLine('');
      const res = await api.getDisruptions();
      setDisruptionsList(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to create disruption.');
    } finally {
      setSubmittingDisruption(false);
    }
  };

  const handleDeactivateDisruption = async (id) => {
    try {
      await api.adminDeactivateDisruption(id);
      setDisruptionsList(prev => prev.map(d => d.id === id ? { ...d, isActive: false } : d));
      setSuccess(t('Service disruption deactivated.'));
    } catch (err) {
      alert('Failed to deactivate disruption: ' + err.message);
    }
  };

  const handleOpenReview = (sug) => {
    setReviewingSug(sug);
    setReviewNotes('');
  };

  const handleReviewSuggestion = async (status) => {
    if (!reviewingSug) return;
    setSubmittingReview(true);
    
    try {
      await api.adminReviewSuggestion(reviewingSug.id, status, reviewNotes.trim() || null);
      setSuggestionsList(prev => prev.filter(s => s.id !== reviewingSug.id));
      setReviewingSug(null);
      setSuccess(`Suggestion successfully ${status === 1 ? 'approved' : 'rejected'}.`);
    } catch (err) {
      alert('Failed to review suggestion: ' + err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleImportStops = async () => {
    if (!stopsCsv.trim()) return;
    setImportingStops(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.adminImportStops(stopsCsv.trim());
      setSuccess(`Imported ${res.data} stops successfully!`);
      setStopsCsv('');
    } catch (err) {
      setError(err.message || 'Failed to import stops.');
    } finally {
      setImportingStops(false);
    }
  };

  const handleImportTrains = async () => {
    if (!trainsCsv.trim()) return;
    setImportingTrains(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.adminImportTrains(trainsCsv.trim());
      setSuccess(`Imported ${res.data} trains and schedules successfully!`);
      setTrainsCsv('');
    } catch (err) {
      setError(err.message || 'Failed to import trains.');
    } finally {
      setImportingTrains(false);
    }
  };

  const handleGeoJsonFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setTrackGeoJson(evt.target.result);
    };
    reader.readAsText(file);
  };

  const handleUploadTrack = async (e) => {
    e.preventDefault();
    if (!selectedTrainId || !trackGeoJson.trim()) return;
    setUploadingTrack(true);
    setError('');
    setSuccess('');
    try {
      await api.uploadTrack(selectedTrainId, trackGeoJson.trim());
      setSuccess('Railway track polyline uploaded and stop coordinates snapped successfully!');
      setTrackGeoJson('');
      setSelectedTrainId('');
    } catch (err) {
      setError(err.message || 'Failed to upload track geometry.');
    } finally {
      setUploadingTrack(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!systemSettings) return;
    setSavingSettings(true);
    setError('');
    setSuccess('');
    try {
      await api.adminUpdateSystemSettings(systemSettings);
      setSuccess('System settings saved successfully.');
    } catch (err) {
      setError('Failed to save settings: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleApproveUpdate = async (id) => {
    try {
      await api.adminApproveLiveUpdate(id);
      setPendingUpdates(prev => prev.filter(u => u.id !== id));
      setSuccess('Live update approved successfully.');
    } catch (err) {
      alert('Error approving update: ' + err.message);
    }
  };

  const handleDeleteUpdate = async (id) => {
    if (!window.confirm(t('Are you sure you want to reject and delete this update?'))) return;
    try {
      await api.adminDeleteLiveUpdate(id);
      setPendingUpdates(prev => prev.filter(u => u.id !== id));
      setSuccess('Live update rejected and deleted.');
    } catch (err) {
      alert('Error deleting update: ' + err.message);
    }
  };

  const handleConfirmRemoval = async (id) => {
    if (!window.confirm(t('Are you sure you want to confirm removal and delete this update?'))) return;
    try {
      await api.adminDeleteLiveUpdate(id);
      setRemovalRequests(prev => prev.filter(u => u.id !== id));
      setSuccess('Live update deleted successfully.');
    } catch (err) {
      alert('Error confirming removal: ' + err.message);
    }
  };

  const handleDenyRemoval = async (id) => {
    try {
      await api.adminDenyLiveUpdateRemoval(id);
      setRemovalRequests(prev => prev.filter(u => u.id !== id));
      setSuccess('Live update removal request denied.');
    } catch (err) {
      alert('Error denying removal: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{t('adminPanel')}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t('adminSub')}</p>
      </div>

      {/* Tabs Row */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px' }}>
        <button onClick={() => setActiveTab('dashboard')} className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
          <LayoutDashboard size={16} />Dashboard
        </button>
        <button onClick={() => setActiveTab('users')} className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
          <Users size={16} />{t('users')}
        </button>
        <button onClick={() => setActiveTab('suggestions')} className={`btn ${activeTab === 'suggestions' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
          <Lightbulb size={16} />{t('routeSuggestions')}
        </button>
        <button onClick={() => setActiveTab('disruptions')} className={`btn ${activeTab === 'disruptions' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
          <AlertTriangle size={16} />{t('serviceAlerts')}
        </button>
        <button onClick={() => setActiveTab('import')} className={`btn ${activeTab === 'import' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
          <Upload size={16} />{t('bulkImportCsv')}
        </button>
        <button onClick={() => setActiveTab('tracks')} className={`btn ${activeTab === 'tracks' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
          <Upload size={16} />{t('railwayTracks') !== 'railwayTracks' ? t('railwayTracks') : 'Railway Tracks'}
        </button>
        <button onClick={() => setActiveTab('updates')} className={`btn ${activeTab === 'updates' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
          <Clock size={16} />{t('liveUpdatesModeration')}
        </button>
        <button onClick={() => setActiveTab('settings')} className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
          <Settings size={16} />System Settings
        </button>
      </div>

      {error && <div style={{ color: 'var(--danger)', fontWeight: 500 }}>{error}</div>}
      {success && <div style={{ color: 'var(--success)', fontWeight: 500 }}>{success}</div>}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
          <Clock className="animate-spin" size={32} color="var(--accent-primary)" />
        </div>
      ) : (
        <>
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && statsData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Stats Grid */}
              <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: 'rgba(66, 153, 225, 0.1)', padding: '12px', borderRadius: '10px' }}>
                    <Users size={24} color="#4299e1" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Users</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{statsData.totalUsers ?? 0}</div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: 'rgba(72, 187, 120, 0.1)', padding: '12px', borderRadius: '10px' }}>
                    <Train size={24} color="#48bb78" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Active Trains</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{statsData.totalTrains ?? 0}</div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: 'rgba(237, 137, 54, 0.1)', padding: '12px', borderRadius: '10px' }}>
                    <Calendar size={24} color="#ed8936" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Active Trips Today</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{statsData.activeTripsToday ?? 0}</div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: 'rgba(159, 122, 234, 0.1)', padding: '12px', borderRadius: '10px' }}>
                    <Clock size={24} color="#9f7aea" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Live Updates Today</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{statsData.totalLiveUpdatesToday ?? 0}</div>
                  </div>
                </div>
              </div>

              {/* Side-by-side Map (70%) and Passenger Live updates (30%) */}
              <DashboardMapAndFeed statsData={statsData} api={api} isRTL={isRTL} />
            </div>
          )}

          {/* USERS MANAGEMENT TAB */}
          {activeTab === 'users' && (
            <div className="glass-panel" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isRTL ? 'right' : 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '16px 24px' }}>{t('tableName')}</th>
                    <th style={{ padding: '16px 24px' }}>{t('tableEmail')}</th>
                    <th style={{ padding: '16px 24px' }}>{t('tableRole')}</th>
                    <th style={{ padding: '16px 24px' }}>{t('tableStatus')}</th>
                    <th style={{ padding: '16px 24px', textAlign: 'center' }}>{t('tableActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((usr) => (
                    <tr key={usr.id} style={{ borderBottom: '1px solid rgba(120,120,120,0.02)', fontSize: '0.9rem' }}>
                      <td style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--text-primary)' }}>{usr.displayName}</td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{usr.email}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{usr.role === 1 || usr.role === 'Admin' ? t('adminPanel') : t('following')}</span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        {usr.isSuspended ? (
                          <span className="badge badge-cancelled" style={{ fontSize: '0.65rem' }}>{t('suspend')}</span>
                        ) : (
                          <span className="badge badge-on-time" style={{ fontSize: '0.65rem' }}>{t('active')}</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 24px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button 
                          onClick={() => handleToggleSuspend(usr.id, usr.isSuspended)}
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '0.75rem', borderColor: usr.isSuspended ? 'var(--success)' : 'var(--danger)', color: usr.isSuspended ? 'var(--success)' : 'var(--danger)' }}
                        >
                          {usr.isSuspended ? <UserCheck size={14} /> : <UserMinus size={14} />}
                          <span>{usr.isSuspended ? t('unsuspend') : t('suspend')}</span>
                        </button>
                        <button 
                          onClick={() => handleChangeRole(usr.id, usr.role)}
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                        >
                          <Shield size={14} />
                          <span>{t('changeRole')}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ROUTE SUGGESTIONS TAB */}
          {activeTab === 'suggestions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {suggestionsList.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>{t('noPendingSug')}</p>
              ) : (
                suggestionsList.map((sug) => (
                  <div key={sug.id} className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '20px' }}>
                    <div style={{ flexGrow: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                          {t('timetableHeader')} #{sug.trainNumber} - {isRTL ? sug.nameAr : sug.nameEn}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>By: {sug.authorName || 'User'}</span>
                      </div>
                      
                      {(isRTL ? sug.routeDescriptionAr : sug.routeDescriptionEn) && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          <strong>{isRTL ? 'المسار:' : 'Route:'}</strong> {isRTL ? sug.routeDescriptionAr : sug.routeDescriptionEn}
                        </p>
                      )}
                      {(isRTL ? sug.descriptionAr : sug.descriptionEn) && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          <strong>{isRTL ? 'ملاحظات:' : 'Notes:'}</strong> {isRTL ? sug.descriptionAr : sug.descriptionEn}
                        </p>
                      )}
                    </div>
                    
                    <button onClick={() => handleOpenReview(sug)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
                      {t('review')}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* SERVICE ALERTS TAB */}
          {activeTab === 'disruptions' && (
            <div className="dashboard-grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: '16px' }}>{t('activeDisruptions')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {disruptionsList.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('noUpdatesFeed')}</p>
                  ) : (
                    disruptionsList.map((alert) => (
                      <div 
                        key={alert.id} 
                        style={{ 
                          padding: '16px', 
                          borderRadius: '10px', 
                          border: `1px solid ${alert.isActive ? 'rgba(239,68,68,0.2)' : 'var(--border-color)'}`,
                          background: alert.isActive ? 'var(--danger-glow)' : 'rgba(120,120,120,0.01)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                            {isRTL ? alert.titleAr : alert.titleEn} {alert.affectedLine && <span style={{ color: 'var(--warning)', marginInlineStart: '8px' }}>Line {alert.affectedLine}</span>}
                          </div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {isRTL ? alert.descriptionAr : alert.descriptionEn}
                          </p>
                        </div>
                        {alert.isActive ? (
                          <button onClick={() => handleDeactivateDisruption(alert.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent' }}>
                            {t('deactivate')}
                          </button>
                        ) : (
                          <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{t('deactivated')}</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: '16px' }}>{t('createServiceAlert')}</h3>
                <form onSubmit={handleCreateDisruption}>
                  <div className="form-group">
                    <label>{t('title')} (En)</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. Cairo-Alex Line Delay" 
                      value={dispTitleEn}
                      onChange={(e) => setDispTitleEn(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('title')} (Ar)</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="تأخيرات خط القاهرة" 
                      value={dispTitleAr}
                      onChange={(e) => setDispTitleAr(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('desc')} (En)</label>
                    <textarea 
                      className="input-field" 
                      rows="2" 
                      placeholder="Expected delay time..." 
                      value={dispDescEn}
                      onChange={(e) => setDispDescEn(e.target.value)}
                      required
                    ></textarea>
                  </div>
                  <div className="form-group">
                    <label>{t('desc')} (Ar)</label>
                    <textarea 
                      className="input-field" 
                      rows="2" 
                      placeholder="الوصف باللغة العربية..." 
                      value={dispDescAr}
                      onChange={(e) => setDispDescAr(e.target.value)}
                    ></textarea>
                  </div>
                  <div className="form-group">
                    <label>{t('affectedLineOpt')}</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. Train 980" 
                      value={dispLine}
                      onChange={(e) => setDispLine(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-danger" style={{ width: '100%' }} disabled={submittingDisruption || !dispTitleEn.trim()}>
                    {submittingDisruption ? t('loading') : t('postAlert')}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* CSV DATA IMPORT TAB */}
          {activeTab === 'import' && (
            <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileSpreadsheet size={18} color="var(--accent-primary)" /> {t('importStops')}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  {t('stopsCsvColumns')}
                </p>
                <textarea 
                  className="input-field" 
                  rows="10" 
                  placeholder="Code,NameAr,NameEn,CityAr,CityEn,Latitude,Longitude" 
                  value={stopsCsv}
                  onChange={(e) => setStopsCsv(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                  disabled={importingStops}
                ></textarea>
                <button 
                  onClick={handleImportStops} 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: '16px' }}
                  disabled={importingStops || !stopsCsv.trim()}
                >
                  {importingStops ? t('loading') : t('parseStopsBtn')}
                </button>
              </div>

              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileSpreadsheet size={18} color="var(--accent-secondary)" /> {t('importTrains')}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  {t('trainsCsvColumns')}
                </p>
                <textarea 
                  className="input-field" 
                  rows="10" 
                  placeholder="TrainNumber,NameAr,NameEn,DescAr,DescEn,StopCode,StopOrder,Arrival,Departure" 
                  value={trainsCsv}
                  onChange={(e) => setTrainsCsv(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                  disabled={importingTrains}
                ></textarea>
                <button 
                  onClick={handleImportTrains} 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: '16px' }}
                  disabled={importingTrains || !trainsCsv.trim()}
                >
                  {importingTrains ? t('loading') : t('parseTrainsBtn')}
                </button>
              </div>
            </div>
          )}

          {/* RAILWAY GEOMETRIES / TRACKS TAB */}
          {activeTab === 'tracks' && (
            <div className="glass-panel" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
              <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={18} color="var(--accent-primary)" /> {t('uploadRailwayTrack') !== 'uploadRailwayTrack' ? t('uploadRailwayTrack') : 'Upload Track Geometry'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Upload a GeoJSON file containing a LineString representing the real Egyptian railway tracks for the selected train. The backend will snap existing stops along the polyline.
              </p>
              
              <form onSubmit={handleUploadTrack}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.85rem', marginBottom: '6px', display: 'block', color: 'var(--text-primary)' }}>{t('selectTrain') !== 'selectTrain' ? t('selectTrain') : 'Select Train'}</label>
                  <select 
                    className="input-field" 
                    value={selectedTrainId} 
                    onChange={(e) => setSelectedTrainId(e.target.value)}
                    required
                    disabled={uploadingTrack}
                  >
                    <option value="">-- {t('selectTrain') !== 'selectTrain' ? t('selectTrain') : 'Select Train'} --</option>
                    {trainsList.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.trainNumber} - {isRTL ? t.nameAr : t.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.85rem', marginBottom: '6px', display: 'block', color: 'var(--text-primary)' }}>{t('selectGeoJsonFile') !== 'selectGeoJsonFile' ? t('selectGeoJsonFile') : 'Select GeoJSON File (.geojson / .json)'}</label>
                  <input 
                    type="file" 
                    accept=".json,.geojson" 
                    onChange={handleGeoJsonFileChange}
                    className="input-field" 
                    style={{ padding: '8px' }}
                    disabled={uploadingTrack}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.85rem', marginBottom: '6px', display: 'block', color: 'var(--text-primary)' }}>{t('orPasteGeoJson') !== 'orPasteGeoJson' ? t('orPasteGeoJson') : 'Or Paste Raw GeoJSON (LineString)'}</label>
                  <textarea 
                    className="input-field" 
                    rows="8" 
                    placeholder='{"type": "LineString", "coordinates": [[31.23, 30.06], ...]}' 
                    value={trackGeoJson}
                    onChange={(e) => setTrackGeoJson(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                    disabled={uploadingTrack}
                    required
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: '16px' }}
                  disabled={uploadingTrack || !selectedTrainId || !trackGeoJson.trim()}
                >
                  {uploadingTrack ? t('loading') : (t('uploadTrack') !== 'uploadTrack' ? t('uploadTrack') : 'Upload Track')}
                </button>
              </form>
            </div>
          )}

          {/* LIVE UPDATES MODERATION TAB */}
          {activeTab === 'updates' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* Pending Approval Section */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: '16px' }}>{t('pendingApproval')}</h3>
                {pendingUpdates.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('noPendingUpdates')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {pendingUpdates.map((upd) => (
                      <div 
                        key={upd.id} 
                        style={{ 
                          padding: '16px', 
                          borderRadius: '10px', 
                          border: '1px solid var(--border-color)',
                          background: 'rgba(120,120,120,0.01)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '12px'
                        }}
                      >
                        <div style={{ flexGrow: 1 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                            Train #{upd.trainNumber} ({upd.tripDate}) - By: {upd.authorName}
                          </div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {upd.content}
                          </p>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                            {upd.statusTag && <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{upd.statusTag}</span>}
                            {upd.crowdState && <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>{upd.crowdState}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleDeleteUpdate(upd.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent' }}>
                            {t('reject')}
                          </button>
                          <button onClick={() => handleApproveUpdate(upd.id)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem', background: 'var(--success)', borderColor: 'var(--success)' }}>
                            {t('approve')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Removal Requests Section */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: '16px' }}>{t('removalRequests')}</h3>
                {removalRequests.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('noRemovalRequests')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {removalRequests.map((upd) => (
                      <div 
                        key={upd.id} 
                        style={{ 
                          padding: '16px', 
                          borderRadius: '10px', 
                          border: '1px solid rgba(239,68,68,0.2)',
                          background: 'var(--danger-glow)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '12px'
                        }}
                      >
                        <div style={{ flexGrow: 1 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                            Train #{upd.trainNumber} ({upd.tripDate}) - By: {upd.authorName}
                          </div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {upd.content}
                          </p>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                            {upd.statusTag && <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{upd.statusTag}</span>}
                            {upd.crowdState && <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>{upd.crowdState}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleDenyRemoval(upd.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                            {t('denyRemoval')}
                          </button>
                          <button onClick={() => handleConfirmRemoval(upd.id)} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                            {t('confirmRemoval')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* SYSTEM SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px' }}>
              <div className="glass-panel" style={{ padding: '28px' }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Settings size={20} color="var(--accent-primary)" /> Content Moderation
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                  Control which types of user-generated content are published immediately versus held for review.
                </p>

                {systemSettings && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {[
                      {
                        key: 'lostFoundPostAutoPublish',
                        label: 'Auto-publish Lost & Found posts',
                        desc: 'When enabled, new Lost & Found posts appear immediately without admin approval.',
                        value: systemSettings.lostFoundPostAutoPublish ?? systemSettings.LostFoundPostAutoPublish,
                        onChange: (v) => setSystemSettings(s => ({ ...s, lostFoundPostAutoPublish: v, LostFoundPostAutoPublish: v }))
                      },
                      {
                        key: 'lostFoundCommentAutoPublish',
                        label: 'Auto-publish Lost & Found comments',
                        desc: 'When enabled, comments on Lost & Found posts appear immediately.',
                        value: systemSettings.lostFoundCommentAutoPublish ?? systemSettings.LostFoundCommentAutoPublish,
                        onChange: (v) => setSystemSettings(s => ({ ...s, lostFoundCommentAutoPublish: v, LostFoundCommentAutoPublish: v }))
                      },
                      {
                        key: 'tripLiveUpdateAutoPublish',
                        label: 'Auto-publish Trip Live Updates',
                        desc: 'When enabled, passenger live update reports appear in the feed without review.',
                        value: systemSettings.tripLiveUpdateAutoPublish ?? systemSettings.TripLiveUpdateAutoPublish,
                        onChange: (v) => setSystemSettings(s => ({ ...s, tripLiveUpdateAutoPublish: v, TripLiveUpdateAutoPublish: v }))
                      },
                      {
                        key: 'tripLiveUpdateRemovalAutoApprove',
                        label: 'Allow direct removal of live update posts',
                        desc: 'When enabled, a user\'s own "remove post" request is immediately processed. When disabled, the request is queued and requires admin approval.',
                        value: systemSettings.tripLiveUpdateRemovalAutoApprove ?? systemSettings.TripLiveUpdateRemovalAutoApprove,
                        onChange: (v) => setSystemSettings(s => ({ ...s, tripLiveUpdateRemovalAutoApprove: v, TripLiveUpdateRemovalAutoApprove: v }))
                      }
                    ].map(item => (
                      <label
                        key={item.key}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '16px',
                          cursor: 'pointer',
                          padding: '16px',
                          borderRadius: '10px',
                          border: `1px solid ${item.value ? 'rgba(34,197,94,0.3)' : 'var(--border-color)'}`,
                          background: item.value ? 'rgba(34,197,94,0.05)' : 'rgba(120,120,120,0.02)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ flexShrink: 0, marginTop: '2px' }}>
                          <input
                            type="checkbox"
                            checked={!!item.value}
                            onChange={(e) => item.onChange(e.target.checked)}
                            style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                          />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '4px' }}>{item.label}</div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleSaveSettings}
                className="btn btn-primary"
                style={{ padding: '12px 24px', fontSize: '0.95rem', fontWeight: 600 }}
                disabled={savingSettings || !systemSettings}
              >
                {savingSettings ? 'Saving...' : '💾 Save Settings'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Review Suggestion Modal */}
      {reviewingSug && (
        <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem' }}>{t('reviewSugTitle')} #{reviewingSug.trainNumber}</h3>
              <button onClick={() => setReviewingSug(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <div><strong>Name:</strong> {isRTL ? reviewingSug.nameAr : reviewingSug.nameEn}</div>
              {(isRTL ? reviewingSug.routeDescriptionAr : reviewingSug.routeDescriptionEn) && <div style={{ marginTop: '6px' }}><strong>Route:</strong> {isRTL ? reviewingSug.routeDescriptionAr : reviewingSug.routeDescriptionEn}</div>}
              {(isRTL ? reviewingSug.descriptionAr : reviewingSug.descriptionEn) && <div style={{ marginTop: '6px' }}><strong>Details:</strong> {isRTL ? reviewingSug.descriptionAr : reviewingSug.descriptionEn}</div>}
            </div>

            <div className="form-group">
              <label>{t('decisionNotes')}</label>
              <textarea 
                className="input-field" 
                rows="3" 
                placeholder="Reason..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                style={{ resize: 'none' }}
                disabled={submittingReview}
              ></textarea>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button 
                onClick={() => handleReviewSuggestion(2)} 
                className="btn btn-danger" 
                style={{ flexGrow: 1 }}
                disabled={submittingReview}
              >
                <X size={16} /> {t('reject')}
              </button>
              <button 
                onClick={() => handleReviewSuggestion(1)} 
                className="btn btn-primary" 
                style={{ flexGrow: 1, background: 'var(--success)' }}
                disabled={submittingReview}
              >
                <Check size={16} /> {t('approve')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
