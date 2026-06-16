import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { usePopup } from '../context/PopupContext';
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
  LayoutDashboard,
  Train,
  Calendar
} from 'lucide-react';
import { DashboardMapAndFeed } from './DashboardMapAndFeed';

export const Admin = () => {
  const { t, isRTL } = useLanguage();
  const { toast, alert, confirm } = usePopup();
  
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'users', 'suggestions', 'disruptions', 'import', 'settings'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Tab States
  const [statsData, setStatsData] = useState(null);

  // Tab States
  const [usersList, setUsersList] = useState([]);
  const [trainSuggestionsList, setTrainSuggestionsList] = useState([]);
  const [stopSuggestionsList, setStopSuggestionsList] = useState([]);
  const [suggestionsSubTab, setSuggestionsSubTab] = useState('trains'); // 'trains' or 'stops'
  const [cities, setCities] = useState([]);
  const [governorates, setGovernorates] = useState([]);
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
  const [reviewingTrain, setReviewingTrain] = useState(null);
  const [reviewingStop, setReviewingStop] = useState(null);
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
    try {
      if (activeTab === 'dashboard') {
        const res = await api.getDashboardStats();
        setStatsData(res.data || null);
      } else if (activeTab === 'users') {
        const res = await api.adminGetUsers();
        setUsersList(res.data || []);
      } else if (activeTab === 'suggestions') {
        const [trainRes, stopRes, citiesRes, govsRes] = await Promise.all([
          api.adminGetPendingTrainSuggestions(),
          api.adminGetPendingStopSuggestions(),
          api.getCities(),
          api.getGovernorates()
        ]);
        setTrainSuggestionsList(trainRes.data || []);
        setStopSuggestionsList(stopRes.data || []);
        setCities(citiesRes.data || []);
        setGovernorates(govsRes.data || []);
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
      toast(`User successfully ${!isCurrentlySuspended ? 'suspended' : 'unsuspended'}.`, 'success');
    } catch (err) {
      toast('Error updating user suspension: ' + err.message, 'error');
    }
  };

  const handleChangeRole = async (userId, currentRole) => {
    const nextRole = currentRole === 'Admin' || currentRole === 1 ? 0 : 1;
    const nextRoleName = nextRole === 1 ? 'Admin' : 'User';
    const isConfirmed = await confirm(`Change this user's role to ${nextRoleName}?`);
    if (!isConfirmed) return;

    try {
      await api.adminChangeUserRole(userId, nextRole);
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, role: nextRoleName } : u));
      toast(`User role changed to ${nextRoleName}.`, 'success');
    } catch (err) {
      toast('Error changing user role: ' + err.message, 'error');
    }
  };

  const handleCreateDisruption = async (e) => {
    e.preventDefault();
    if (!dispTitleEn.trim() || !dispDescEn.trim()) return;

    setSubmittingDisruption(true);

    try {
      await api.adminCreateDisruption(
        dispTitleAr.trim() || dispTitleEn.trim(),
        dispTitleEn.trim(),
        dispDescAr.trim() || dispDescEn.trim(),
        dispDescEn.trim(),
        dispLine.trim() || null
      );
      toast(t('Service disruption alert created.'), 'success');
      setDispTitleEn('');
      setDispTitleAr('');
      setDispDescEn('');
      setDispDescAr('');
      setDispLine('');
      const res = await api.getDisruptions();
      setDisruptionsList(res.data || []);
    } catch (err) {
      toast(err.message || 'Failed to create disruption.', 'error');
    } finally {
      setSubmittingDisruption(false);
    }
  };

  const handleDeactivateDisruption = async (id) => {
    try {
      await api.adminDeactivateDisruption(id);
      setDisruptionsList(prev => prev.map(d => d.id === id ? { ...d, isActive: false } : d));
      toast(t('Service disruption deactivated.'), 'success');
    } catch (err) {
      toast('Failed to deactivate disruption: ' + err.message, 'error');
    }
  };

  const handleOpenTrainReview = (sug) => {
    setReviewingTrain({
      id: sug.id,
      trainNumber: sug.trainNumber || '',
      nameAr: sug.nameAr || '',
      nameEn: sug.nameEn || '',
      descriptionAr: sug.descriptionAr || '',
      descriptionEn: sug.descriptionEn || '',
      routeDescriptionEn: sug.routeDescriptionEn || '',
      adminNotes: sug.adminNotes || ''
    });
  };

  const handleOpenStopReview = (sug) => {
    setReviewingStop({
      id: sug.id,
      code: sug.code || '',
      nameAr: sug.nameAr || '',
      nameEn: sug.nameEn || '',
      cityId: sug.cityId || '',
      newCityNameAr: sug.newCityNameAr || '',
      newCityNameEn: sug.newCityNameEn || '',
      newCityGovernorateId: sug.newCityGovernorateId || '',
      latitude: sug.latitude !== undefined ? sug.latitude : '',
      longitude: sug.longitude !== undefined ? sug.longitude : '',
      descriptionAr: sug.descriptionAr || '',
      descriptionEn: sug.descriptionEn || '',
      adminNotes: sug.adminNotes || ''
    });
  };

  const handleReviewTrainSuggestion = async (status) => {
    if (!reviewingTrain) return;
    setSubmittingReview(true);
    try {
      await api.adminReviewTrainSuggestion(reviewingTrain.id, status, {
        trainNumber: reviewingTrain.trainNumber,
        nameAr: reviewingTrain.nameAr,
        nameEn: reviewingTrain.nameEn,
        descriptionAr: reviewingTrain.descriptionAr || null,
        descriptionEn: reviewingTrain.descriptionEn || null,
        routeDescriptionEn: reviewingTrain.routeDescriptionEn || null,
        adminNotes: reviewingTrain.adminNotes || null
      });

      if (status === 1 || status === 2) {
        setTrainSuggestionsList(prev => prev.filter(s => s.id !== reviewingTrain.id));
        toast(`Train suggestion successfully ${status === 1 ? 'approved' : 'rejected'}.`, 'success');
      } else {
        // Save Draft (status = 0)
        setTrainSuggestionsList(prev => prev.map(s => s.id === reviewingTrain.id ? { ...s, ...reviewingTrain } : s));
        toast('Train suggestion draft saved successfully.', 'success');
      }
      setReviewingTrain(null);
    } catch (err) {
      toast('Failed to review train suggestion: ' + err.message, 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleReviewStopSuggestion = async (status) => {
    if (!reviewingStop) return;

    if (status === 1) {
      if (!reviewingStop.code.trim()) {
        toast('Stop code is required.', 'error');
        return;
      }
      if (!reviewingStop.nameEn.trim() || !reviewingStop.nameAr.trim()) {
        toast('Stop names are required.', 'error');
        return;
      }
      if (!reviewingStop.cityId && (!reviewingStop.newCityNameEn.trim() || !reviewingStop.newCityNameAr.trim() || !reviewingStop.newCityGovernorateId)) {
        toast('Please select an existing city or enter new city details.', 'error');
        return;
      }
    }

    setSubmittingReview(true);
    try {
      await api.adminReviewStopSuggestion(reviewingStop.id, status, {
        code: reviewingStop.code,
        nameAr: reviewingStop.nameAr,
        nameEn: reviewingStop.nameEn,
        cityId: reviewingStop.cityId ? reviewingStop.cityId : null,
        newCityNameAr: reviewingStop.cityId ? null : (reviewingStop.newCityNameAr || null),
        newCityNameEn: reviewingStop.cityId ? null : (reviewingStop.newCityNameEn || null),
        newCityGovernorateId: reviewingStop.cityId ? null : (reviewingStop.newCityGovernorateId || null),
        latitude: reviewingStop.latitude !== '' ? parseFloat(reviewingStop.latitude) : null,
        longitude: reviewingStop.longitude !== '' ? parseFloat(reviewingStop.longitude) : null,
        descriptionAr: reviewingStop.descriptionAr || null,
        descriptionEn: reviewingStop.descriptionEn || null,
        adminNotes: reviewingStop.adminNotes || null
      });

      if (status === 1 || status === 2) {
        setStopSuggestionsList(prev => prev.filter(s => s.id !== reviewingStop.id));
        toast(`Stop suggestion successfully ${status === 1 ? 'approved' : 'rejected'}.`, 'success');
      } else {
        // Save Draft (status = 0)
        setStopSuggestionsList(prev => prev.map(s => s.id === reviewingStop.id ? { ...s, ...reviewingStop } : s));
        toast('Stop suggestion draft saved successfully.', 'success');
      }
      setReviewingStop(null);
    } catch (err) {
      toast('Failed to review stop suggestion: ' + err.message, 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleImportStops = async () => {
    if (!stopsCsv.trim()) return;
    setImportingStops(true);
    try {
      const res = await api.adminImportStops(stopsCsv.trim());
      toast(`Imported ${res.data} stops successfully!`, 'success');
      setStopsCsv('');
    } catch (err) {
      toast(err.message || 'Failed to import stops.', 'error');
    } finally {
      setImportingStops(false);
    }
  };

  const handleImportTrains = async () => {
    if (!trainsCsv.trim()) return;
    setImportingTrains(true);
    try {
      const res = await api.adminImportTrains(trainsCsv.trim());
      toast(`Imported ${res.data} trains and schedules successfully!`, 'success');
      setTrainsCsv('');
    } catch (err) {
      toast(err.message || 'Failed to import trains.', 'error');
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
    try {
      await api.uploadTrack(selectedTrainId, trackGeoJson.trim());
      toast('Railway track polyline uploaded and stop coordinates snapped successfully!', 'success');
      setTrackGeoJson('');
      setSelectedTrainId('');
    } catch (err) {
      toast(err.message || 'Failed to upload track geometry.', 'error');
    } finally {
      setUploadingTrack(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!systemSettings) return;
    setSavingSettings(true);
    try {
      await api.adminUpdateSystemSettings(systemSettings);
      toast('System settings saved successfully.', 'success');
    } catch (err) {
      toast('Failed to save settings: ' + err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleApproveUpdate = async (id) => {
    try {
      await api.adminApproveLiveUpdate(id);
      setPendingUpdates(prev => prev.filter(u => u.id !== id));
      toast('Live update approved successfully.', 'success');
    } catch (err) {
      toast('Error approving update: ' + err.message, 'error');
    }
  };

  const handleDeleteUpdate = async (id) => {
    const isConfirmed = await confirm(t('Are you sure you want to reject and delete this update?'));
    if (!isConfirmed) return;
    try {
      await api.adminDeleteLiveUpdate(id);
      setPendingUpdates(prev => prev.filter(u => u.id !== id));
      toast('Live update rejected and deleted.', 'success');
    } catch (err) {
      toast('Error deleting update: ' + err.message, 'error');
    }
  };

  const handleConfirmRemoval = async (id) => {
    const isConfirmed = await confirm(t('Are you sure you want to confirm removal and delete this update?'));
    if (!isConfirmed) return;
    try {
      await api.adminDeleteLiveUpdate(id);
      setRemovalRequests(prev => prev.filter(u => u.id !== id));
      toast('Live update deleted successfully.', 'success');
    } catch (err) {
      toast('Error confirming removal: ' + err.message, 'error');
    }
  };

  const handleDenyRemoval = async (id) => {
    try {
      await api.adminDenyLiveUpdateRemoval(id);
      setRemovalRequests(prev => prev.filter(u => u.id !== id));
      toast('Live update removal request denied.', 'success');
    } catch (err) {
      toast('Error denying removal: ' + err.message, 'error');
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Sub tabs */}
              <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <button
                  onClick={() => setSuggestionsSubTab('trains')}
                  className={`btn ${suggestionsSubTab === 'trains' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 16px', fontSize: '0.8rem', borderRadius: '8px' }}
                >
                  🚂 {isRTL ? 'مقترحات القطارات' : 'Train Suggestions'}
                </button>
                <button
                  onClick={() => setSuggestionsSubTab('stops')}
                  className={`btn ${suggestionsSubTab === 'stops' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 16px', fontSize: '0.8rem', borderRadius: '8px' }}
                >
                  📍 {isRTL ? 'مقترحات المحطات' : 'Stop Suggestions'}
                </button>
              </div>

              {suggestionsSubTab === 'trains' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {trainSuggestionsList.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
                      {isRTL ? 'لا توجد مقترحات قطارات قيد الانتظار' : 'No pending train suggestions.'}
                    </p>
                  ) : (
                    trainSuggestionsList.map((sug) => (
                      <div key={sug.id} className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '20px' }}>
                        <div style={{ flexGrow: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                              {isRTL ? 'قطار رقم' : 'Train #'} {sug.trainNumber} - {isRTL ? sug.nameAr : sug.nameEn}
                            </span>
                            <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                              {isRTL ? 'قيد المراجعة' : 'Pending Review'}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {isRTL ? 'بواسطة:' : 'By:'} {sug.suggestedByName || 'User'}
                            </span>
                          </div>

                          {sug.routeDescriptionEn && (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                              <strong>{isRTL ? 'المسار المقترح:' : 'Suggested Route:'}</strong> {sug.routeDescriptionEn}
                            </p>
                          )}
                          
                          {(isRTL ? sug.descriptionAr : sug.descriptionEn) && (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              <strong>{isRTL ? 'الوصف:' : 'Description:'}</strong> {isRTL ? sug.descriptionAr : sug.descriptionEn}
                            </p>
                          )}
                        </div>

                        <button onClick={() => handleOpenTrainReview(sug)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
                          {isRTL ? 'مراجعة وتعديل' : 'Review & Edit'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {suggestionsSubTab === 'stops' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {stopSuggestionsList.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
                      {isRTL ? 'لا توجد مقترحات محطات قيد الانتظار' : 'No pending stop suggestions.'}
                    </p>
                  ) : (
                    stopSuggestionsList.map((sug) => (
                      <div key={sug.id} className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '20px' }}>
                        <div style={{ flexGrow: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                              {isRTL ? 'محطة:' : 'Stop:'} {isRTL ? sug.nameAr : sug.nameEn} ({sug.code})
                            </span>
                            <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                              {isRTL ? 'قيد المراجعة' : 'Pending Review'}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {isRTL ? 'بواسطة:' : 'By:'} {sug.suggestedByName || 'User'}
                            </span>
                          </div>

                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            <strong>{isRTL ? 'المدينة:' : 'City:'}</strong>{' '}
                            {sug.cityId
                              ? (isRTL ? sug.cityNameAr : sug.cityNameEn)
                              : `${isRTL ? sug.newCityNameAr : sug.newCityNameEn} (${isRTL ? 'مدينة جديدة' : 'New City'})`}
                          </p>

                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            <strong>{isRTL ? 'الإحداثيات:' : 'Coordinates:'}</strong> Lat: {sug.latitude}, Long: {sug.longitude}
                          </p>

                          {(isRTL ? sug.descriptionAr : sug.descriptionEn) && (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              <strong>{isRTL ? 'الوصف:' : 'Description:'}</strong> {isRTL ? sug.descriptionAr : sug.descriptionEn}
                            </p>
                          )}
                        </div>

                        <button onClick={() => handleOpenStopReview(sug)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
                          {isRTL ? 'مراجعة وتعديل' : 'Review & Edit'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
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

      {/* Review Train Suggestion Modal */}
      {reviewingTrain && (
        <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '650px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 800 }}>
                {isRTL ? 'مراجعة مقترح القطار' : 'Review Train Suggestion'} #{reviewingTrain.trainNumber}
              </h3>
              <button onClick={() => setReviewingTrain(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>{isRTL ? 'رقم القطار' : 'Train Number'}</label>
                <input
                  type="text"
                  className="input-field"
                  value={reviewingTrain.trainNumber}
                  onChange={(e) => setReviewingTrain({ ...reviewingTrain, trainNumber: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>{isRTL ? 'الاسم (بالإنجليزي)' : 'Name (English)'}</label>
                  <input
                    type="text"
                    className="input-field"
                    value={reviewingTrain.nameEn}
                    onChange={(e) => setReviewingTrain({ ...reviewingTrain, nameEn: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{isRTL ? 'الاسم (بالعربي)' : 'Name (Arabic)'}</label>
                  <input
                    type="text"
                    className="input-field"
                    value={reviewingTrain.nameAr}
                    onChange={(e) => setReviewingTrain({ ...reviewingTrain, nameAr: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>{isRTL ? 'الوصف (بالإنجليزي)' : 'Description (English)'}</label>
                  <textarea
                    className="input-field"
                    rows="2"
                    value={reviewingTrain.descriptionEn}
                    onChange={(e) => setReviewingTrain({ ...reviewingTrain, descriptionEn: e.target.value })}
                    style={{ resize: 'none' }}
                  />
                </div>
                <div className="form-group">
                  <label>{isRTL ? 'الوصف (بالعربي)' : 'Description (Arabic)'}</label>
                  <textarea
                    className="input-field"
                    rows="2"
                    value={reviewingTrain.descriptionAr}
                    onChange={(e) => setReviewingTrain({ ...reviewingTrain, descriptionAr: e.target.value })}
                    style={{ resize: 'none' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>
                  {isRTL ? 'مسار المحطات المقترحة (مفصولة بـ " -> ")' : 'Suggested Route Stops (separated by " -> ")'}
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={reviewingTrain.routeDescriptionEn}
                  onChange={(e) => setReviewingTrain({ ...reviewingTrain, routeDescriptionEn: e.target.value })}
                  placeholder="e.g. Cairo -> Tanta -> Alexandria"
                />
                <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                  {isRTL
                    ? 'سيقوم النظام بالبحث عن المحطات حسب أسمائها الإنجليزية وربطها بالترتيب.'
                    : 'System will match stops by their English names and link them in sequence.'}
                </small>
              </div>

              <div className="form-group">
                <label>{isRTL ? 'ملاحظات المراجعة (أو سبب الرفض)' : 'Moderation / Admin Notes'}</label>
                <textarea
                  className="input-field"
                  rows="3"
                  value={reviewingTrain.adminNotes}
                  onChange={(e) => setReviewingTrain({ ...reviewingTrain, adminNotes: e.target.value })}
                  placeholder={isRTL ? 'اكتب ملاحظاتك هنا...' : 'Type feedback reason...'}
                  style={{ resize: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '32px' }}>
              <button
                onClick={() => handleReviewTrainSuggestion(2)}
                className="btn btn-danger"
                disabled={submittingReview}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <X size={16} /> {isRTL ? 'رفض وازالة' : 'Reject'}
              </button>
              
              <button
                onClick={() => handleReviewTrainSuggestion(0)}
                className="btn btn-secondary"
                disabled={submittingReview}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
              >
                💾 {isRTL ? 'حفظ كمسودة' : 'Save Draft'}
              </button>

              <button
                onClick={() => handleReviewTrainSuggestion(1)}
                className="btn btn-primary"
                disabled={submittingReview}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'var(--success)', borderColor: 'var(--success)' }}
              >
                <Check size={16} /> {isRTL ? 'موافقة واعتماد' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Stop Suggestion Modal */}
      {reviewingStop && (
        <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '650px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 800 }}>
                {isRTL ? 'مراجعة مقترح المحطة' : 'Review Stop Suggestion'} ({reviewingStop.code || 'NEW'})
              </h3>
              <button onClick={() => setReviewingStop(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                <div className="form-group">
                  <label>{isRTL ? 'رمز المحطة' : 'Stop Code'}</label>
                  <input
                    type="text"
                    className="input-field"
                    value={reviewingStop.code}
                    onChange={(e) => setReviewingStop({ ...reviewingStop, code: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{isRTL ? 'الاسم (بالإنجليزي)' : 'Name (English)'}</label>
                  <input
                    type="text"
                    className="input-field"
                    value={reviewingStop.nameEn}
                    onChange={(e) => setReviewingStop({ ...reviewingStop, nameEn: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>{isRTL ? 'الاسم (بالعربي)' : 'Name (Arabic)'}</label>
                <input
                  type="text"
                  className="input-field"
                  value={reviewingStop.nameAr}
                  onChange={(e) => setReviewingStop({ ...reviewingStop, nameAr: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>{isRTL ? 'خط العرض' : 'Latitude'}</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="input-field"
                    value={reviewingStop.latitude}
                    onChange={(e) => setReviewingStop({ ...reviewingStop, latitude: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{isRTL ? 'خط الطول' : 'Longitude'}</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="input-field"
                    value={reviewingStop.longitude}
                    onChange={(e) => setReviewingStop({ ...reviewingStop, longitude: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>{isRTL ? 'المدينة' : 'City'}</label>
                <select
                  className="input-field"
                  value={reviewingStop.cityId || 'new'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setReviewingStop({
                      ...reviewingStop,
                      cityId: val === 'new' ? '' : val
                    });
                  }}
                >
                  <option value="new" style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                    ✨ {isRTL ? 'إضافة مدينة جديدة...' : 'Add New City...'}
                  </option>
                  {cities.map(c => (
                    <option key={c.id} value={c.id}>
                      {isRTL ? c.nameAr : c.nameEn} ({isRTL ? c.governorateAr || c.governorateNameAr : c.governorateEn || c.governorateNameEn})
                    </option>
                  ))}
                </select>
              </div>

              {/* New City form if cityId is empty/new */}
              {(!reviewingStop.cityId) && (
                <div style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.05)',
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-primary)' }}>
                    📌 {isRTL ? 'تفاصيل المدينة الجديدة' : 'New City Details'}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>{isRTL ? 'اسم المدينة (En)' : 'City Name (En)'}</label>
                      <input
                        type="text"
                        className="input-field"
                        value={reviewingStop.newCityNameEn || ''}
                        onChange={(e) => setReviewingStop({ ...reviewingStop, newCityNameEn: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>{isRTL ? 'اسم المدينة (Ar)' : 'City Name (Ar)'}</label>
                      <input
                        type="text"
                        className="input-field"
                        value={reviewingStop.newCityNameAr || ''}
                        onChange={(e) => setReviewingStop({ ...reviewingStop, newCityNameAr: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>{isRTL ? 'المحافظة' : 'Governorate'}</label>
                    <select
                      className="input-field"
                      value={reviewingStop.newCityGovernorateId || ''}
                      onChange={(e) => setReviewingStop({ ...reviewingStop, newCityGovernorateId: e.target.value })}
                      required
                    >
                      <option value="">-- {isRTL ? 'اختر محافظة' : 'Select Governorate'} --</option>
                      {governorates.map(g => (
                        <option key={g.id} value={g.id}>
                          {isRTL ? g.nameAr : g.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>{isRTL ? 'الوصف (En)' : 'Description (En)'}</label>
                  <textarea
                    className="input-field"
                    rows="2"
                    value={reviewingStop.descriptionEn}
                    onChange={(e) => setReviewingStop({ ...reviewingStop, descriptionEn: e.target.value })}
                    style={{ resize: 'none' }}
                  />
                </div>
                <div className="form-group">
                  <label>{isRTL ? 'الوصف (Ar)' : 'Description (Ar)'}</label>
                  <textarea
                    className="input-field"
                    rows="2"
                    value={reviewingStop.descriptionAr}
                    onChange={(e) => setReviewingStop({ ...reviewingStop, descriptionAr: e.target.value })}
                    style={{ resize: 'none' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>{isRTL ? 'ملاحظات المراجعة (أو سبب الرفض)' : 'Moderation / Admin Notes'}</label>
                <textarea
                  className="input-field"
                  rows="3"
                  value={reviewingStop.adminNotes}
                  onChange={(e) => setReviewingStop({ ...reviewingStop, adminNotes: e.target.value })}
                  placeholder={isRTL ? 'اكتب ملاحظاتك هنا...' : 'Type feedback reason...'}
                  style={{ resize: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '32px' }}>
              <button
                onClick={() => handleReviewStopSuggestion(2)}
                className="btn btn-danger"
                disabled={submittingReview}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <X size={16} /> {isRTL ? 'رفض وازالة' : 'Reject'}
              </button>

              <button
                onClick={() => handleReviewStopSuggestion(0)}
                className="btn btn-secondary"
                disabled={submittingReview}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
              >
                💾 {isRTL ? 'حفظ كمسودة' : 'Save Draft'}
              </button>

              <button
                onClick={() => handleReviewStopSuggestion(1)}
                className="btn btn-primary"
                disabled={submittingReview}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'var(--success)', borderColor: 'var(--success)' }}
              >
                <Check size={16} /> {isRTL ? 'موافقة واعتماد' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
