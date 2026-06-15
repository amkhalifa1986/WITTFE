import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { Users, Search, Clock } from 'lucide-react';

export const FollowersBox = ({ type, id }) => {
  const { t, isRTL } = useLanguage();
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const fetchFollowers = async () => {
    try {
      setLoading(true);
      setError('');
      let res;
      if (type === 'train') {
        res = await api.getTrainFollowers(id);
      } else {
        res = await api.getTripFollowers(id);
      }
      if (res.isSuccess) {
        setFollowers(res.data || []);
      } else {
        setError(res.error || t('failedToLoadFollowers') || 'Failed to load followers.');
      }
    } catch (err) {
      console.error(err);
      setError(t('failedToLoadFollowers') || 'Failed to load followers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchFollowers();
      setCurrentPage(1);
      setSearchTerm('');
    }
  }, [id, type]);

  const filteredFollowers = followers.filter(f => 
    f.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredFollowers.length / pageSize);
  const paginatedFollowers = filteredFollowers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
        <Users size={18} color="var(--accent-primary)" />
        <span>
          {isRTL ? 'المتابعون' : 'Followers'} ({filteredFollowers.length})
        </span>
      </h3>

      {/* Search Input */}
      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', [isRTL ? 'right' : 'left']: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input 
          type="text" 
          className="input-field" 
          placeholder={isRTL ? 'البحث بالاسم أو البريد...' : 'Search by name or email...'} 
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          style={{ 
            paddingLeft: isRTL ? '12px' : '36px', 
            paddingRight: isRTL ? '36px' : '12px', 
            width: '100%', 
            fontSize: '0.85rem',
            height: '36px'
          }}
        />
      </div>

      {/* List Container */}
      <div style={{ flexGrow: 1, minHeight: '120px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
            <Clock className="animate-spin" size={24} color="var(--accent-primary)" />
          </div>
        ) : error ? (
          <div style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>
            {error}
          </div>
        ) : filteredFollowers.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '40px 10px' }}>
            {isRTL ? 'لا يوجد متابعون.' : 'No followers found.'}
          </div>
        ) : (
          paginatedFollowers.map((follower) => (
            <div 
              key={follower.userId} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '12px 16px', 
                borderRadius: '10px', 
                border: '1px solid var(--border-color)', 
                background: 'rgba(120, 120, 120, 0.01)',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  background: 'var(--accent-primary)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: '#fff', 
                  fontWeight: 'bold', 
                  fontSize: '0.8rem',
                  flexShrink: 0
                }}>
                  {follower.displayName ? follower.displayName[0].toUpperCase() : 'U'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {follower.displayName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {follower.email}
                  </div>
                </div>
              </div>

              {/* Type-Specific Info */}
              {type === 'train' && (
                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '120px' }}>
                  {follower.daysOfWeek && follower.daysOfWeek.map((day) => {
                    const dayLabelsEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const dayLabelsAr = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
                    return (
                      <span 
                        key={day} 
                        className="badge badge-info" 
                        style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px', fontWeight: '500' }}
                        title={dayLabelsEn[day]}
                      >
                        {isRTL ? dayLabelsAr[day] : dayLabelsEn[day]}
                      </span>
                    );
                  })}
                </div>
              )}

              {type === 'trip' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                  <span className="badge badge-secondary" style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '3px' }}>
                    {t(follower.personalStatus)}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {new Date(follower.followedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {!loading && !error && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
            disabled={currentPage === 1}
            style={{ padding: '6px 12px', fontSize: '0.75rem', minWidth: 'auto', margin: 0, height: '28px' }}
          >
            {isRTL ? 'السابق' : 'Prev'}
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {isRTL ? `صفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
          </span>
          <button 
            className="btn btn-secondary" 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
            disabled={currentPage === totalPages}
            style={{ padding: '6px 12px', fontSize: '0.75rem', minWidth: 'auto', margin: 0, height: '28px' }}
          >
            {isRTL ? 'التالي' : 'Next'}
          </button>
        </div>
      )}
    </div>
  );
};

export default FollowersBox;
