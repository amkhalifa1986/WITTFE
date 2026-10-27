import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { usePopup } from '../context/PopupContext';
import { 
  User, 
  Mail, 
  Shield, 
  Award, 
  Calendar, 
  ChevronLeft,
  Clock,
  UserCheck,
  UserMinus,
  AlertCircle
} from 'lucide-react';

export const AdminUserDetails = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  const { toast, alert, confirm } = usePopup();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [pointsSummary, setPointsSummary] = useState({ totalPoints: 0, logs: [] });
  
  // Filtering points logs
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  const years = [2026, 2027, 2028];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      // Find the user from the full users list to get basic info
      const usersRes = await api.adminGetUsers();
      const user = usersRes.data.find(u => u.id === userId);
      if (!user) {
        throw new Error('User not found.');
      }
      setUserInfo(user);

      // Fetch point logs
      const pointsRes = await api.adminGetUserPoints(userId, selectedYear || null, selectedMonth || null);
      setPointsSummary(pointsRes.data || { totalPoints: 0, logs: [] });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load user details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [userId, selectedYear, selectedMonth]);

  const handleToggleSuspend = async () => {
    if (!userInfo) return;
    const actionText = userInfo.isSuspended ? t('unsuspend') : t('suspend');
    const isConfirmed = await confirm({
      title: `${actionText} User`,
      message: `Are you sure you want to ${actionText.toLowerCase()} ${userInfo.displayName}?`
    });

    if (!isConfirmed) return;

    try {
      await api.adminToggleUserSuspension(userInfo.id, !userInfo.isSuspended);
      setUserInfo(prev => ({ ...prev, isSuspended: !prev.isSuspended }));
      toast(`User suspension state toggled successfully.`, 'success');
    } catch (err) {
      toast(err.message || 'Failed to toggle user suspension.', 'error');
    }
  };

  const handleChangeRole = async () => {
    if (!userInfo) return;
    const newRole = userInfo.role === 'Admin' || userInfo.role === 1 ? 'User' : 'Admin';
    const isConfirmed = await confirm({
      title: 'Change User Role',
      message: `Change ${userInfo.displayName}'s role to ${newRole}?`
    });

    if (!isConfirmed) return;

    try {
      await api.adminChangeUserRole(userInfo.id, newRole === 'Admin' ? 1 : 0);
      setUserInfo(prev => ({ ...prev, role: newRole }));
      toast(`User role updated to ${newRole}.`, 'success');
    } catch (err) {
      toast(err.message || 'Failed to update user role.', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading user details...
      </div>
    );
  }

  if (error || !userInfo) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <AlertCircle size={48} color="var(--danger)" style={{ marginBottom: '16px' }} />
        <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.2rem', marginBottom: '8px' }}>Error</div>
        <div style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{error || 'User not found.'}</div>
        <button onClick={() => navigate('/admin')} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <ChevronLeft size={16} /> Back to Admin Panel
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', padding: '24px' }}>
      {/* Header / Back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          onClick={() => navigate('/admin')} 
          className="btn btn-secondary"
          style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}
        >
          <ChevronLeft size={16} /> {isRTL ? 'العودة للإدارة' : 'Back to Admin'}
        </button>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
          {isRTL ? 'تفاصيل المستخدم' : 'User Details'}
        </h2>
      </div>

      {/* Grid: User Profile vs Points Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px', alignItems: 'start' }}>
        
        {/* Left Column: User Profile info card */}
        <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '2rem', color: 'var(--accent-contrast)' }}>
              {userInfo.displayName?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.25rem', color: 'var(--text-primary)' }}>{userInfo.displayName}</h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Joined: {new Date(userInfo.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 0 }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Mail size={18} color="var(--text-secondary)" />
              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{userInfo.email}</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Shield size={18} color="var(--text-secondary)" />
              <div>
                <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                  {userInfo.role === 'Admin' || userInfo.role === 1 ? t('adminPanel') : t('following')}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Award size={18} color="#f59e0b" />
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f59e0b' }}>
                {pointsSummary.totalPoints ?? 0} {t('points')}
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 0 }} />

          {/* User actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              onClick={handleToggleSuspend}
              className="btn btn-secondary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderColor: userInfo.isSuspended ? 'var(--success)' : 'var(--danger)', color: userInfo.isSuspended ? 'var(--success)' : 'var(--danger)' }}
            >
              {userInfo.isSuspended ? <UserCheck size={16} /> : <UserMinus size={16} />}
              <span>{userInfo.isSuspended ? t('unsuspend') : t('suspend')}</span>
            </button>
            <button 
              onClick={handleChangeRole}
              className="btn btn-secondary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Shield size={16} />
              <span>{t('changeRole')}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Points Log table with filters */}
        <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
              {t('userPointsHistory') || 'User Points History'}
            </h3>
            
            {/* Filters */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', outline: 'none' }}
              >
                <option value="" style={{ background: '#222' }}>{isRTL ? 'كل السنوات' : 'All Years'}</option>
                {years.map(y => <option key={y} value={y} style={{ background: '#222' }}>{y}</option>)}
              </select>

              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', outline: 'none' }}
              >
                <option value="" style={{ background: '#222' }}>{isRTL ? 'كل الأشهر' : 'All Months'}</option>
                {months.map(m => <option key={m} value={m} style={{ background: '#222' }}>{m}</option>)}
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isRTL ? 'right' : 'left', minWidth: '500px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '12px 16px' }}>{t('pointsAction') || 'Action'}</th>
                  <th style={{ padding: '12px 16px' }}>{t('points') || 'Points'}</th>
                  <th style={{ padding: '12px 16px' }}>{t('trips') || 'Trip'}</th>
                  <th style={{ padding: '12px 16px' }}>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {pointsSummary.logs.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No point log records match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  pointsSummary.logs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(120,120,120,0.02)', fontSize: '0.88rem' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {isRTL ? log.actionNameAr : log.actionNameEn}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: log.pointsAwarded > 0 ? '#10b981' : '#ef4444' }}>
                        {log.pointsAwarded > 0 ? `+${log.pointsAwarded}` : log.pointsAwarded}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {log.tripId ? (
                          <span 
                            onClick={() => navigate(`/trip/${log.tripId}`)}
                            style={{ cursor: 'pointer', color: 'var(--accent-primary)', textDecoration: 'underline' }}
                          >
                            View Trip
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={12} />
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
