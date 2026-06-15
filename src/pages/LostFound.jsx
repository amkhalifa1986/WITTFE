import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/authContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  PlusCircle, 
  MessageSquare, 
  Phone, 
  Train, 
  Calendar, 
  CheckCircle,
  HelpCircle,
  Clock,
  Send,
  Trash2,
  X
} from 'lucide-react';
import { AdInterstitial } from '../components/AdInterstitial';

export const LostFound = () => {
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();
  
  const [activeTab, setActiveTab] = useState(0); // 0 = Lost, 1 = Found
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modals & Details State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [postComments, setPostComments] = useState([]);
  
  // Create Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [trainNumber, setTrainNumber] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [postType, setPostType] = useState('0'); // '0' = Lost, '1' = Found
  const [submitting, setSubmitting] = useState(false);

  // Comment Input State
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchPosts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getLostFoundList(activeTab);
      setPosts(res.data || []);
    } catch (err) {
      console.error(err);
      setError(t('Failed to fetch posts. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [activeTab]);

  const handleOpenDetails = async (post) => {
    try {
      const res = await api.getLostFoundDetails(post.id);
      setSelectedPost(res.data);
      setPostComments(res.data.comments || []);
    } catch (err) {
      alert('Failed to retrieve post details: ' + err.message);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setSubmitting(true);
    try {
      await api.createLostFoundPost({
        title,
        description,
        imageUrl: imageUrl.trim() || null,
        type: parseInt(postType),
        trainNumber: trainNumber.trim() || null,
        contactInfo: contactInfo.trim() || null
      });

      setTitle('');
      setDescription('');
      setImageUrl('');
      setTrainNumber('');
      setContactInfo('');
      setShowCreateModal(false);
      
      fetchPosts();
    } catch (err) {
      alert('Failed to submit post: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedPost) return;

    setSubmittingComment(true);
    try {
      await api.addLostFoundComment(selectedPost.id, newComment);
      
      const res = await api.getLostFoundDetails(selectedPost.id);
      setSelectedPost(res.data);
      setPostComments(res.data.comments || []);
      setNewComment('');
    } catch (err) {
      alert('Failed to add comment: ' + err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    try {
      await api.deleteLostFoundComment(commentId);
      setPostComments(prev => prev.filter(c => c.id !== commentId));
    } catch (err) {
      alert('Failed to delete comment: ' + err.message);
    }
  };

  const handleMarkResolved = async (postId) => {
    if (!window.confirm('Mark this report as resolved? It will close comments.')) return;
    try {
      await api.markLostFoundResolved(postId);
      setSelectedPost(prev => prev ? { ...prev, status: 'Closed' } : null);
      fetchPosts();
    } catch (err) {
      alert('Failed to resolve report: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <AdInterstitial pageKey="lostFound" />
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{t('lostFoundTitle')}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>{t('lostFoundSub')}</p>
        </div>

        <button 
          onClick={() => setShowCreateModal(true)} 
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <PlusCircle size={18} /> {t('fileReport')}
        </button>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px' }}>
        <button 
          onClick={() => setActiveTab(0)}
          className={`btn ${activeTab === 0 ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.875rem' }}
        >
          {t('lostItems')}
        </button>
        <button 
          onClick={() => setActiveTab(1)}
          className={`btn ${activeTab === 1 ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.875rem' }}
        >
          {t('foundItems')}
        </button>
      </div>

      {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}

      {/* Grid listing */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
          <Clock className="animate-spin" size={32} color="var(--accent-primary)" />
        </div>
      ) : posts.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <HelpCircle size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
          <h3 style={{ color: 'var(--text-primary)' }}>{t('noActiveReports')}</h3>
          <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>{t('everythingAccounted')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {posts.map((post) => (
            <div 
              key={post.id}
              onClick={() => handleOpenDetails(post)}
              className="glass-panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                overflow: 'hidden',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {post.imageUrl && (
                <div style={{ height: '180px', width: '100%', overflow: 'hidden' }}>
                  <img src={api.resolveImageUrl(post.imageUrl)} alt={post.title} style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ padding: '24px', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <span className={`badge ${post.type === 'Lost' ? 'badge-cancelled' : 'badge-on-time'}`} style={{ fontSize: '0.6rem' }}>
                    {t(post.type === 'Lost' ? 'lostItems' : 'foundItems')}
                  </span>
                  {post.status === 'Closed' && (
                    <span className="badge badge-info" style={{ fontSize: '0.6rem' }}>{t('resolved')}</span>
                  )}
                </div>

                <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)' }}>{post.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', flexGrow: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                  {post.description}
                </p>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {post.trainNumber && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Train size={12} /> {t('timetableHeader')} #{post.trainNumber}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={12} /> {new Date(post.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details View Modal */}
      {selectedPost && (
        <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
              <span className={`badge ${selectedPost.type === 'Lost' ? 'badge-cancelled' : 'badge-on-time'}`}>
                {t(selectedPost.type === 'Lost' ? 'lostItems' : 'foundItems')}
              </span>
              <button onClick={() => setSelectedPost(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {selectedPost.imageUrl && (
                <div style={{ width: '100%', maxHeight: '240px', borderRadius: '12px', overflow: 'hidden' }}>
                  <img src={api.resolveImageUrl(selectedPost.imageUrl)} alt={selectedPost.title} style={{ width: '100%', objectFit: 'contain', background: 'rgba(0,0,0,0.2)' }} />
                </div>
              )}

              <div>
                <h2 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700 }}>{selectedPost.title}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '6px' }}>
                  <span>{selectedPost.authorName || 'Passenger'}</span>
                  <span>•</span>
                  <span>{new Date(selectedPost.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                {selectedPost.description}
              </p>

              <div style={{ padding: '16px', background: 'rgba(120,120,120,0.02)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedPost.trainNumber && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                    <Train size={16} color="var(--accent-primary)" />
                    <span>{t('timetableHeader')}: <strong>#{selectedPost.trainNumber}</strong></span>
                  </div>
                )}
                {selectedPost.contactInfo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                    <Phone size={16} color="var(--success)" />
                    <span>{t('contactInfoOpt')}: <strong>{selectedPost.contactInfo}</strong></span>
                  </div>
                )}
              </div>

              {user && user.id === selectedPost.authorId && selectedPost.status !== 'Closed' && (
                <button 
                  onClick={() => handleMarkResolved(selectedPost.id)}
                  className="btn btn-primary"
                  style={{ background: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}
                >
                  <CheckCircle size={16} /> {t('markAsResolved')}
                </button>
              )}

              {/* Comments Section */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <h4 style={{ color: 'var(--text-primary)', marginBottom: '16px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageSquare size={16} /> {t('comments')} ({postComments.length})
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                  {postComments.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('noUpdatesFeed')}</p>
                  ) : (
                    postComments.map((comment) => (
                      <div key={comment.id} style={{ display: 'flex', gap: '12px', background: 'rgba(120,120,120,0.01)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>
                          {comment.authorName ? comment.authorName[0].toUpperCase() : 'U'}
                        </div>
                        <div style={{ flexGrow: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{comment.authorName}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {new Date(comment.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {comment.content}
                          </p>
                        </div>
                        {user && user.id === comment.authorId && (
                          <button 
                            onClick={() => handleDeleteComment(comment.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            title="Delete comment"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {selectedPost.status !== 'Closed' ? (
                  <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '10px' }}>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder={t('askQuestion')}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      disabled={submittingComment}
                      style={{ padding: '10px 16px' }}
                    />
                    <button type="submit" className="btn btn-primary" style={{ padding: '10px 16px' }} disabled={submittingComment || !newComment.trim()}>
                      <Send size={16} />
                    </button>
                  </form>
                ) : (
                  <p style={{ color: 'var(--success)', fontSize: '0.85rem', fontWeight: 500, textAlign: 'center', background: 'var(--success-glow)', padding: '10px', borderRadius: '8px' }}>
                    {t('resolvedBanner')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Report Create Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ color: 'var(--text-primary)', fontSize: '1.25rem' }}>{t('fileReport')}</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePost}>
              <div className="form-group">
                <label>{t('reportType')}</label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="postType" 
                      value="0" 
                      checked={postType === '0'}
                      onChange={() => setPostType('0')}
                      style={{ accentColor: 'var(--danger)' }}
                    />
                    {t('iLostItem')}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="postType" 
                      value="1" 
                      checked={postType === '1'}
                      onChange={() => setPostType('1')}
                      style={{ accentColor: 'var(--success)' }}
                    />
                    {t('iFoundItem')}
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>{t('title')}</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder={t('walletPlaceholder')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label>{t('desc')}</label>
                <textarea 
                  className="input-field" 
                  rows="3" 
                  placeholder={t('descPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  disabled={submitting}
                  style={{ resize: 'none' }}
                ></textarea>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>{t('trainNoOpt')}</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. 980"
                    value={trainNumber}
                    onChange={(e) => setTrainNumber(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label>{t('contactInfoOpt')}</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Phone or email"
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>{t('imageUrlOpt')}</label>
                <input 
                  type="url" 
                  className="input-field" 
                  placeholder="https://example.com/wallet.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary" style={{ flexGrow: 1 }} disabled={submitting}>
                  {t('cancel')}
                </button>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }} disabled={submitting || !title.trim() || !description.trim()}>
                  {submitting ? t('loading') : t('submitReport')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LostFound;
