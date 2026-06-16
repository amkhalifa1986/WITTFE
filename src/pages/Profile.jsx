import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/authContext';
import { useLanguage } from '../context/LanguageContext';
import { usePopup } from '../context/PopupContext';
import api from '../services/api';
import { AdInterstitial } from '../components/AdInterstitial';
import { User, Mail, FileText, Camera, History, Train, Clock, X, Trash2, Upload, Loader } from 'lucide-react';

export const Profile = () => {
  const { user, updateUserProfile } = useAuth();
  const { t, isRTL } = useLanguage();
  const { toast, alert, confirm } = usePopup();
  
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.getTripHistory();
        setHistory(res.data || []);
      } catch (err) {
        console.error('Failed to load history', err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, []);

  const [upcomingTrips, setUpcomingTrips] = useState([]);
  const [followedPlans, setFollowedPlans] = useState([]);
  const [loadingFollowPlans, setLoadingFollowPlans] = useState(true);

  const fetchFollowPlansData = async () => {
    try {
      const resUpcoming = await api.getUpcomingTrips();
      const resFollowed = await api.getFollowedTrainsPlan();
      setUpcomingTrips(resUpcoming.data || []);
      setFollowedPlans(resFollowed.data || []);
    } catch (err) {
      console.error('Failed to load follow plans data:', err);
    } finally {
      setLoadingFollowPlans(false);
    }
  };

  useEffect(() => {
    fetchFollowPlansData();
  }, []);

  const handleUnfollowUpcomingTrip = async (tripId) => {
    const isConfirmed = await confirm(t('unfollowTripConfirm'));
    if (!isConfirmed) return;

    try {
      const res = await api.unfollowTrip(tripId);
      if (res.isSuccess) {
        toast(t('unfollowedTripSuccess'), 'success');
        fetchFollowPlansData();
      }
    } catch (err) {
      console.error(err);
      toast(err.message || t('failedToUnfollowTrip'), 'error');
    }
  };

  const handleCancelFollowPlan = async (trainId) => {
    const isConfirmed = await confirm(t('unfollowPlanConfirm'));
    if (!isConfirmed) return;

    try {
      const res = await api.deleteFollowPlan(trainId);
      if (res.isSuccess) {
        toast(t('planDeleted'), 'success');
        fetchFollowPlansData();
      }
    } catch (err) {
      console.error(err);
      toast(err.message || t('failedToCancelFollowPlan'), 'error');
    }
  };

  const getGroupedPlans = () => {
    const groups = {};
    followedPlans.forEach(plan => {
      if (!groups[plan.trainId]) {
        groups[plan.trainId] = {
          trainId: plan.trainId,
          trainNumber: plan.trainNumber,
          trainNameAr: plan.trainNameAr,
          trainNameEn: plan.trainNameEn,
          configs: []
        };
      }
      groups[plan.trainId].configs.push({
        id: plan.id,
        dayOfWeek: plan.dayOfWeek,
        roleType: plan.roleType,
        targetStopId: plan.targetStopId,
        targetStopNameAr: plan.targetStopNameAr,
        targetStopNameEn: plan.targetStopNameEn,
        alertLeadTimeMinutes: plan.alertLeadTimeMinutes
      });
    });
    
    // Sort configs by day of week
    Object.values(groups).forEach(group => {
      group.configs.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    });
    
    return Object.values(groups);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      await updateUserProfile(displayName.trim(), bio.trim() || null, avatarUrl ? avatarUrl.trim() : null);
      toast(t('Profile updated successfully!'), 'success');
    } catch (err) {
      toast(err.message || t('failedToUpdateProfile'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFile(true);

    try {
      const res = await api.uploadAvatar(file);
      if (res.data) {
        setAvatarUrl(res.data);
        await updateUserProfile(displayName.trim(), bio.trim() || null, res.data);
        toast(t('Profile updated successfully!'), 'success');
        setShowPhotoModal(false);
      }
    } catch (err) {
      toast(err.message || t('Failed to upload photo.'), 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemovePhoto = async () => {
    setUploadingFile(true);

    try {
      setAvatarUrl('');
      await updateUserProfile(displayName.trim(), bio.trim() || null, null);
      toast(t('Profile updated successfully!'), 'success');
      setShowPhotoModal(false);
    } catch (err) {
      toast(err.message || t('Failed to remove photo.'), 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <AdInterstitial pageKey="profile" />
      <div>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{t('myProfile')}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t('profileSub')}</p>
      </div>

      <div className="dashboard-grid">
        {/* Profile Card Form */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <User size={22} color="var(--accent-primary)" /> {t('accountInfo')}
          </h3>

          <form onSubmit={handleUpdateProfile}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'relative',
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  background: 'var(--accent-gradient)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.8rem',
                  fontWeight: 800,
                  color: '#fff',
                  overflow: 'hidden'
                }}>
                  {avatarUrl ? (
                    <img src={api.resolveImageUrl(avatarUrl)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    user?.displayName ? user.displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'U'
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(true)}
                  style={{
                    position: 'absolute',
                    bottom: '-4px',
                    [isRTL ? 'left' : 'right']: '-4px',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'var(--accent-primary)',
                    border: '2px solid var(--bg-card)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    transition: 'all 0.2s ease',
                    padding: 0
                  }}
                  title={t('editAvatar')}
                >
                  <Camera size={14} />
                </button>
              </div>
              <div>
                <h4 style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>{user?.displayName}</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <Mail size={12} /> {user?.email}
                </p>
              </div>
            </div>

            <div className="form-group">
              <label>{t('displayName')}</label>
              <input 
                type="text" 
                className="input-field" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label>{t('desc')}</label>
              <div style={{ position: 'relative' }}>
                <FileText size={16} style={{ position: 'absolute', [isRTL ? 'right' : 'left']: '16px', top: '16px', color: 'var(--text-muted)' }} />
                <textarea 
                  className="input-field" 
                  rows="3" 
                  placeholder={t('bioPlaceholder')}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  style={{ paddingInlineStart: '48px', resize: 'none' }}
                  disabled={submitting}
                ></textarea>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={submitting}>
              {submitting ? t('loading') : t('saveProfile')}
            </button>
          </form>
        </div>

        {/* Trip History */}
        <div className="glass-panel" style={{ padding: '32px', minHeight: '400px' }}>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={22} color="var(--accent-secondary)" /> {t('travelLog')}
          </h3>

          {loadingHistory ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
              <Clock className="animate-spin" size={24} color="var(--accent-primary)" />
            </div>
          ) : history.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '40px' }}>
              {t('noHistoryYet')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {history.map((item) => (
                <div 
                  key={item.id}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(120,120,120,0.01)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'rgba(6, 182, 212, 0.1)',
                      color: 'var(--accent-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontFamily: 'Outfit'
                    }}>
                      {item.trainNumber}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                        {isRTL ? item.trainNameAr : item.trainNameEn}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {t('trackDate')}: {item.tripDate}
                      </div>
                    </div>
                  </div>

                  <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                    {t(item.personalStatus) || t('following')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Next 24 Hours Block */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={22} color="var(--accent-primary)" /> {t('upcomingTripsHeader')}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px' }}>
            {t('upcomingTripsInfo')}
          </p>

          {loadingFollowPlans ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px' }}>
              <Clock className="animate-spin" size={24} color="var(--accent-primary)" />
            </div>
          ) : upcomingTrips.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '40px' }}>
              {t('noUpcomingTrips')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {upcomingTrips.map((trip) => (
                <div 
                  key={trip.id}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(120,120,120,0.01)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
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
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {trip.tripDate} • <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>{t(trip.roleType.toLowerCase())}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleUnfollowUpcomingTrip(trip.id)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: 'var(--danger)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title={t('unfollowTrip')}
                    >
                      <Trash2 size={12} />
                      <span>{t('bypass')}</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '10px', fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>{t('targetStation')}: </span>
                      <strong style={{ color: 'var(--text-primary)' }}>{isRTL ? trip.targetStopNameAr : trip.targetStopNameEn}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>{isRTL ? 'الوصول' : 'Arr'}: </span>
                      <strong style={{ color: 'var(--accent-primary)' }}>{trip.targetStopScheduledArrival?.slice(0, 5)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Followed Trains Block */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Train size={22} color="var(--accent-secondary)" /> {t('followedTrainsHeader')}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px' }}>
            {t('followedTrainsSub')}
          </p>

          {loadingFollowPlans ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px' }}>
              <Clock className="animate-spin" size={24} color="var(--accent-primary)" />
            </div>
          ) : followedPlans.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '40px' }}>
              {t('noFollowedPlans')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {getGroupedPlans().map((group) => (
                <div 
                  key={group.trainId}
                  style={{
                    padding: '20px',
                    borderRadius: '14px',
                    background: 'rgba(120,120,120,0.01)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: 'rgba(6, 182, 212, 0.1)',
                        color: 'var(--accent-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontFamily: 'Outfit',
                        fontSize: '1rem'
                      }}>
                        {group.trainNumber}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                          {isRTL ? group.trainNameAr : group.trainNameEn}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {isRTL ? group.trainNameEn : group.trainNameAr}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCancelFollowPlan(group.trainId)}
                      style={{
                        background: 'none',
                        color: 'var(--text-muted)',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '6px',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title={t('unfollowPlan')}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--danger)';
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-muted)';
                        e.currentTarget.style.background = 'none';
                      }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {group.configs.map((config) => {
                      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][config.dayOfWeek];
                      return (
                        <div 
                          key={config.id}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: 'rgba(120,120,120,0.02)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.8rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--accent-primary)', minWidth: '85px' }}>
                            <Clock size={12} />
                            <span>{t(dayName)}</span>
                          </div>

                          <div style={{ minWidth: '85px' }}>
                            <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                              {t(config.roleType.toLowerCase())}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '4px', flex: '1 1 auto', minWidth: '130px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{t('targetStation')}: </span>
                            <strong style={{ color: 'var(--text-primary)' }}>{isRTL ? config.targetStopNameAr : config.targetStopNameEn}</strong>
                          </div>

                          <div style={{ display: 'flex', gap: '4px', minWidth: '95px', justifyContent: isRTL ? 'flex-start' : 'flex-end' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{t('alertTiming')}: </span>
                            <strong style={{ color: 'var(--accent-secondary)' }}>{config.alertLeadTimeMinutes} {isRTL ? 'د' : 'm'}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Photo Upload/Remove Modal */}
      {showPhotoModal && (
        <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '32px', textAlign: 'center', position: 'relative' }}>
            <button 
              type="button" 
              onClick={() => setShowPhotoModal(false)} 
              style={{ position: 'absolute', [isRTL ? 'left' : 'right']: '20px', top: '20px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              disabled={uploadingFile}
            >
              <X size={20} />
            </button>

            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.25rem', marginBottom: '24px' }}>{t('editAvatar')}</h3>

            {/* Big Avatar Preview */}
            <div style={{
              position: 'relative',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '3rem',
              fontWeight: 800,
              color: '#fff',
              margin: '0 auto 24px auto',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}>
              {avatarUrl ? (
                <img src={api.resolveImageUrl(avatarUrl)} alt="avatar preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                user?.displayName ? user.displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'U'
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
                id="avatar-file-upload-input"
                disabled={uploadingFile}
              />
              
              <label 
                htmlFor="avatar-file-upload-input" 
                className="btn btn-primary" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  cursor: uploadingFile ? 'not-allowed' : 'pointer',
                  opacity: uploadingFile ? 0.7 : 1,
                  margin: 0
                }}
              >
                {uploadingFile ? <Loader className="animate-spin" size={16} /> : <Upload size={16} />}
                <span>{uploadingFile ? t('uploading') : t('uploadPhoto')}</span>
              </label>

              {avatarUrl && (
                <button 
                  type="button" 
                  onClick={handleRemovePhoto} 
                  className="btn btn-secondary" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '8px', 
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    color: 'var(--danger)',
                    background: 'rgba(239, 68, 68, 0.05)',
                    cursor: uploadingFile ? 'not-allowed' : 'pointer'
                  }}
                  disabled={uploadingFile}
                >
                  <Trash2 size={16} />
                  <span>{t('removePhoto')}</span>
                </button>
              )}

              <button 
                type="button" 
                onClick={() => setShowPhotoModal(false)} 
                className="btn btn-secondary"
                style={{ marginTop: '8px' }}
                disabled={uploadingFile}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
