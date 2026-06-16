import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { usePopup } from '../context/PopupContext';
import { AdInterstitial } from '../components/AdInterstitial';
import { 
  Lightbulb, 
  Info, 
  Clock, 
  CheckCircle, 
  XCircle, 
  MapPin, 
  Train, 
  GripVertical, 
  Trash2,
  Plus
} from 'lucide-react';
import L from 'leaflet';

export const Suggestions = () => {
  const { t, isRTL } = useLanguage();
  const { toast, alert } = usePopup();
  
  // Tab states
  const [activeFormTab, setActiveFormTab] = useState('train'); // 'train' or 'stop'
  const [activeLogTab, setActiveLogTab] = useState('train');   // 'train' or 'stop'

  // Train Suggestion Form State
  const [trainNumber, setTrainNumber] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [selectedTrainStops, setSelectedStops] = useState([]);
  const [selectedStopId, setSelectedStopId] = useState('');
  const [trainExists, setTrainExists] = useState(false);
  const [checkingTrain, setCheckingTrain] = useState(false);

  // Stop Suggestion Form State
  const [stopCode, setStopCode] = useState('');
  const [stopNameEn, setStopNameEn] = useState('');
  const [stopNameAr, setStopNameAr] = useState('');
  const [cityId, setCityId] = useState('');
  const [newCityNameEn, setNewCityNameEn] = useState('');
  const [newCityNameAr, setNewCityNameAr] = useState('');
  const [newCityGovernorateId, setNewCityGovernorateId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [stopDescriptionEn, setStopDescriptionEn] = useState('');
  const [stopDescriptionAr, setStopDescriptionAr] = useState('');

  // Lookup data
  const [cities, setCities] = useState([]);
  const [governorates, setGovernorates] = useState([]);
  const [allStops, setAllStops] = useState([]);

  // Log history data
  const [mySuggestions, setMySuggestions] = useState([]);
  const [myStopSuggestions, setMyStopSuggestions] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Leaflet map refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapMarkerRef = useRef(null);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const [trainRes, stopRes] = await Promise.all([
        api.getMySuggestions(),
        api.getMyStopSuggestions()
      ]);
      setMySuggestions(trainRes.data || []);
      setMyStopSuggestions(stopRes.data || []);
    } catch (err) {
      console.error('Failed to retrieve suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const [citiesRes, govsRes, stopsRes] = await Promise.all([
        api.getCities(),
        api.getGovernorates(),
        api.getStops()
      ]);
      setCities(citiesRes.data || []);
      setGovernorates(govsRes.data || []);
      setAllStops(stopsRes.data || []);
    } catch (err) {
      console.error('Failed to load lookup lists:', err);
    }
  };

  useEffect(() => {
    fetchSuggestions();
    fetchLookups();
  }, []);

  // Check if train number exists (on blur)
  const handleTrainNumberBlur = async () => {
    const num = trainNumber.trim();
    if (!num) {
      setTrainExists(false);
      return;
    }
    setCheckingTrain(true);
    try {
      const res = await api.searchTrains({ number: num });
      const exists = res.data?.some(t => t.trainNumber.toLowerCase() === num.toLowerCase());
      setTrainExists(exists);
    } catch (err) {
      console.error(err);
      setTrainExists(false);
    } finally {
      setCheckingTrain(false);
    }
  };

  // Map Initialization for Suggest Stop
  useEffect(() => {
    if (activeFormTab !== 'stop') {
      // Clean up map when switching away
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        mapMarkerRef.current = null;
      }
      return;
    }

    // Delay slightly to ensure DOM is ready
    const timer = setTimeout(() => {
      if (!mapInstanceRef.current && mapContainerRef.current) {
        const defaultCenter = [26.8206, 30.8025]; // Egypt Center
        
        const map = L.map(mapContainerRef.current).setView(defaultCenter, 6);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 20
        }).addTo(map);

        mapInstanceRef.current = map;

        // Try to get user GPS
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude: userLat, longitude: userLng } = position.coords;
              const userPos = [userLat, userLng];
              map.setView(userPos, 13);
              
              setLatitude(userLat.toFixed(6));
              setLongitude(userLng.toFixed(6));

              const marker = L.marker(userPos, { draggable: true }).addTo(map);
              mapMarkerRef.current = marker;

              marker.on('dragend', () => {
                const pos = marker.getLatLng();
                setLatitude(pos.lat.toFixed(6));
                setLongitude(pos.lng.toFixed(6));
              });
            },
            () => {
              // Geolocation failed/denied. Place marker at default center.
              const marker = L.marker(defaultCenter, { draggable: true }).addTo(map);
              mapMarkerRef.current = marker;

              marker.on('dragend', () => {
                const pos = marker.getLatLng();
                setLatitude(pos.lat.toFixed(6));
                setLongitude(pos.lng.toFixed(6));
              });
            }
          );
        } else {
          const marker = L.marker(defaultCenter, { draggable: true }).addTo(map);
          mapMarkerRef.current = marker;

          marker.on('dragend', () => {
            const pos = marker.getLatLng();
            setLatitude(pos.lat.toFixed(6));
            setLongitude(pos.lng.toFixed(6));
          });
        }

        // Map Click selection
        map.on('click', (e) => {
          const { lat, lng } = e.latlng;
          setLatitude(lat.toFixed(6));
          setLongitude(lng.toFixed(6));

          if (mapMarkerRef.current) {
            mapMarkerRef.current.setLatLng([lat, lng]);
          } else {
            const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
            mapMarkerRef.current = marker;
            
            marker.on('dragend', () => {
              const pos = marker.getLatLng();
              setLatitude(pos.lat.toFixed(6));
              setLongitude(pos.lng.toFixed(6));
            });
          }
        });
      }
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [activeFormTab]);

  // Train Stops Handlers
  const handleAddStop = () => {
    if (!selectedStopId) return;
    const stopObj = allStops.find(s => s.id === selectedStopId);
    if (!stopObj) return;

    if (selectedTrainStops.some(s => s.id === stopObj.id)) {
      toast(isRTL ? 'هذه المحطة مضافة بالفعل للقطار!' : 'This stop is already added to the train!', 'warning');
      return;
    }

    setSelectedStops([...selectedTrainStops, stopObj]);
    setSelectedStopId('');
  };

  const handleDragReorder = (fromIndex, toIndex) => {
    const reordered = [...selectedTrainStops];
    const [removed] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, removed);
    setSelectedStops(reordered);
  };

  const handleRemoveStop = (index) => {
    setSelectedStops(selectedTrainStops.filter((_, i) => i !== index));
  };

  // Handle Train Suggestion Submit
  const handleTrainSubmit = async (e) => {
    e.preventDefault();
    if (!trainNumber.trim() || !nameEn.trim() || !nameAr.trim()) return;

    if (selectedTrainStops.length < 2) {
      toast(isRTL ? 'يرجى إضافة محطتين على الأقل لمسار القطار.' : 'Please add at least two stops for the train route.', 'warning');
      return;
    }

    setSubmitting(true);

    // Format route representation: English names only (as requested "no need to have stops AR")
    const routeStr = selectedTrainStops.map(s => s.nameEn).join(' -> ');

    try {
      await api.suggestTrain({
        trainNumber: trainNumber.trim(),
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        descriptionAr: descriptionAr.trim() || null,
        descriptionEn: descriptionEn.trim() || null,
        routeDescriptionAr: null, // no need to have stops AR
        routeDescriptionEn: routeStr
      });

      toast(t('Thank you! Your route suggestion has been submitted to moderators.'), 'success');
      setTrainNumber('');
      setNameEn('');
      setNameAr('');
      setDescriptionEn('');
      setDescriptionAr('');
      setSelectedStops([]);
      setTrainExists(false);
      
      fetchSuggestions();
    } catch (err) {
      toast(err.message || 'Failed to submit train suggestion.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Stop Suggestion Submit
  const handleStopSubmit = async (e) => {
    e.preventDefault();
    if (!stopCode.trim() || !stopNameEn.trim() || !stopNameAr.trim()) return;
    
    const isNewCity = cityId === 'new';
    if (isNewCity && (!newCityNameAr.trim() || !newCityNameEn.trim() || !newCityGovernorateId)) {
      toast(t('Please fill all new city mandatory details.'), 'warning');
      return;
    }
    if (!isNewCity && !cityId) {
      toast(t('Please select a city.'), 'warning');
      return;
    }

    setSubmitting(true);

    try {
      await api.suggestStop({
        code: stopCode.trim().toUpperCase(),
        nameAr: stopNameAr.trim(),
        nameEn: stopNameEn.trim(),
        cityId: isNewCity ? null : cityId,
        newCityNameAr: isNewCity ? newCityNameAr.trim() : null,
        newCityNameEn: isNewCity ? newCityNameEn.trim() : null,
        newCityGovernorateId: isNewCity ? newCityGovernorateId : null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        descriptionAr: stopDescriptionAr.trim() || null,
        descriptionEn: stopDescriptionEn.trim() || null
      });

      toast(t('Thank you! Your stop suggestion has been submitted to moderators.'), 'success');
      setStopCode('');
      setStopNameEn('');
      setStopNameAr('');
      setCityId('');
      setNewCityNameEn('');
      setNewCityNameAr('');
      setNewCityGovernorateId('');
      setLatitude('');
      setLongitude('');
      setStopDescriptionEn('');
      setStopDescriptionAr('');
      
      if (mapMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(mapMarkerRef.current);
        mapMarkerRef.current = null;
      }
      
      fetchSuggestions();
    } catch (err) {
      toast(err.message || 'Failed to submit stop suggestion.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="badge badge-on-time" style={{ fontSize: '0.7rem' }}>
            <CheckCircle size={10} /> {t('approved')}
          </span>
        );
      case 'Rejected':
        return (
          <span className="badge badge-cancelled" style={{ fontSize: '0.7rem' }}>
            <XCircle size={10} /> {t('rejected')}
          </span>
        );
      default:
        return (
          <span className="badge badge-delayed" style={{ fontSize: '0.7rem' }}>
            <Clock size={10} /> {t('pending')}
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <AdInterstitial pageKey="suggestions" />
      <div>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{t('suggestions')}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t('suggestionsSub')}</p>
      </div>

      <div className="dashboard-grid">
        {/* Propose Form Panel */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          {/* Tab selector */}
          <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', paddingBottom: '8px' }}>
            <button 
              onClick={() => setActiveFormTab('train')} 
              className={`btn ${activeFormTab === 'train' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Train size={16} /> {t('suggestTrainTab')}
            </button>
            <button 
              onClick={() => setActiveFormTab('stop')} 
              className={`btn ${activeFormTab === 'stop' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <MapPin size={16} /> {t('suggestStopTab')}
            </button>
          </div>

          {/* Form Content: Train suggestion */}
          {activeFormTab === 'train' && (
            <form onSubmit={handleTrainSubmit}>
              {/* Train Number */}
              <div className="form-group">
                <label>{t('trainNumberTab')} *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. 980" 
                  value={trainNumber}
                  onChange={(e) => setTrainNumber(e.target.value)}
                  onBlur={handleTrainNumberBlur}
                  required
                  disabled={submitting}
                />
              </div>

              {checkingTrain && <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '12px' }}>Checking database...</div>}

              {trainExists && (
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'var(--warning-glow)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: 'var(--warning)',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                  lineHeight: 1.4
                }}>
                  {t('trainNumberExistsWarning')}
                </div>
              )}

              {/* Train Name (English) & (Arabic) in one row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>{t('trainNameEn')}</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Cairo - Aswan VIP" 
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label>{t('trainNameAr')}</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="مثال: قطار القاهرة أسوان" 
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Train Description English & Arabic in one row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>{t('descEn')}</label>
                  <textarea 
                    className="input-field" 
                    rows="2" 
                    placeholder="Service type, comfort..."
                    value={descriptionEn}
                    onChange={(e) => setDescriptionEn(e.target.value)}
                    disabled={submitting}
                    style={{ resize: 'none' }}
                  ></textarea>
                </div>
                <div className="form-group">
                  <label>{t('descAr')}</label>
                  <textarea 
                    className="input-field" 
                    rows="2" 
                    placeholder="تفاصيل الخدمة والدرجة..."
                    value={descriptionAr}
                    onChange={(e) => setDescriptionAr(e.target.value)}
                    disabled={submitting}
                    style={{ resize: 'none' }}
                  ></textarea>
                </div>
              </div>

              {/* Stops Selection DDL Section */}
              <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '12px', display: 'block' }}>
                  {isRTL ? 'محطات خط سير القطار *' : 'Train Route Stops *'}
                </label>
                
                {/* DDL Input + Add Button */}
                <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '12px', alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <select 
                      className="input-field"
                      value={selectedStopId}
                      onChange={(e) => setSelectedStopId(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="">-- {isRTL ? 'اختر محطة لإضافتها' : 'Select Stop to Add'} --</option>
                      {allStops.map(s => (
                        <option key={s.id} value={s.id}>
                          {isRTL ? s.nameAr : s.nameEn} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleAddStop}
                    className="btn btn-secondary"
                    style={{ height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}
                    disabled={submitting || !selectedStopId}
                  >
                    <Plus size={16} /> {isRTL ? 'إضافة' : 'Add'}
                  </button>
                </div>

                {/* Selected Stops Order list */}
                {selectedTrainStops.length > 0 ? (
                  <div style={{ 
                    marginTop: '16px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px', 
                    maxHeight: '220px', 
                    overflowY: 'auto',
                    padding: '8px',
                    background: 'rgba(120, 120, 120, 0.02)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                  }}>
                    {selectedTrainStops.map((stop, index) => (
                      <div 
                        key={`${stop.id}-${index}`} 
                        className="glass-panel"
                        draggable={!submitting}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedIndex(index);
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnter={() => {
                          if (draggedIndex !== null && draggedIndex !== index) {
                            handleDragReorder(draggedIndex, index);
                            setDraggedIndex(index);
                          }
                        }}
                        onDragEnd={() => setDraggedIndex(null)}
                        style={{ 
                          padding: '10px 14px', 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          cursor: submitting ? 'not-allowed' : draggedIndex === index ? 'grabbing' : 'grab',
                          opacity: draggedIndex === index ? 0.4 : 1,
                          border: draggedIndex === index ? '1px dashed var(--accent-primary)' : '1px solid var(--border-color)',
                          transition: 'opacity 0.15s ease, border-color 0.15s ease',
                          userSelect: 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <GripVertical size={16} style={{ color: 'var(--text-muted)', cursor: submitting ? 'not-allowed' : 'grab' }} />
                          <span style={{ 
                            width: '24px', 
                            height: '24px', 
                            borderRadius: '50%', 
                            background: 'var(--accent-gradient)', 
                            color: '#fff', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                          }}>
                            {index + 1}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {isRTL ? stop.nameAr : stop.nameEn} ({stop.code})
                          </span>
                        </div>

                        {/* Delete button */}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <button 
                            type="button"
                            onClick={() => handleRemoveStop(index)}
                            disabled={submitting}
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', borderRadius: '4px', borderColor: 'var(--danger-glow)', color: 'var(--danger)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '10px', fontStyle: 'italic' }}>
                    {isRTL ? 'لم يتم إضافة أي محطات بعد. يرجى إضافة المحطات بالترتيب.' : 'No stops added yet. Please add stops in sequence.'}
                  </p>
                )}
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '20px' }} 
                disabled={submitting || !trainNumber.trim() || !nameEn.trim() || !nameAr.trim() || selectedTrainStops.length < 2}
              >
                {submitting ? t('loading') : t('submitSuggestion')}
              </button>
            </form>
          )}

          {/* Form Content: Stop suggestion */}
          {activeFormTab === 'stop' && (
            <form onSubmit={handleStopSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                <div className="form-group">
                  <label>{t('stopCodeLabel')}</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. CAI" 
                    value={stopCode}
                    onChange={(e) => setStopCode(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label>{t('stopNameEnLabel')}</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Ramses Station" 
                    value={stopNameEn}
                    onChange={(e) => setStopNameEn(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>{t('stopNameArLabel')}</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="مثال: محطة رمسيس" 
                  value={stopNameAr}
                  onChange={(e) => setStopNameAr(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label>{t('selectCityLabel')}</label>
                <select 
                  className="input-field" 
                  value={cityId} 
                  onChange={(e) => setCityId(e.target.value)}
                  required
                  disabled={submitting}
                >
                  <option value="">-- {t('selectCityLabel')} --</option>
                  {cities.map(c => (
                    <option key={c.id} value={c.id}>
                      {isRTL ? c.nameAr : c.nameEn} ({isRTL ? c.governorateNameAr : c.governorateNameEn})
                    </option>
                  ))}
                  <option value="new" style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>{t('addNewCityOption')}</option>
                </select>
              </div>

              {/* Inline new City Fields */}
              {cityId === 'new' && (
                <div style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.05)',
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                  marginBottom: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>{t('newCityNameEnLabel')}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="e.g. Tanta" 
                        value={newCityNameEn}
                        onChange={(e) => setNewCityNameEn(e.target.value)}
                        required
                        disabled={submitting}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>{t('newCityNameArLabel')}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="مثال: طنطا" 
                        value={newCityNameAr}
                        onChange={(e) => setNewCityNameAr(e.target.value)}
                        required
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>{t('selectGovernorateLabel')}</label>
                    <select 
                      className="input-field" 
                      value={newCityGovernorateId} 
                      onChange={(e) => setNewCityGovernorateId(e.target.value)}
                      required
                      disabled={submitting}
                    >
                      <option value="">-- {t('selectGovernorateLabel')} --</option>
                      {governorates.map(g => (
                        <option key={g.id} value={g.id}>
                          {isRTL ? g.nameAr : g.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Map coordinate selection */}
              <div className="form-group">
                <label>{t('mapSelectCoordinates')}</label>
                <div 
                  ref={mapContainerRef} 
                  id="stop-suggest-map" 
                  className="glass-panel"
                  style={{ height: '260px', marginTop: '6px', overflow: 'hidden', position: 'relative', zIndex: 10 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>{t('latitudeField')}</label>
                  <input 
                    type="number" 
                    step="0.000001"
                    className="input-field" 
                    placeholder="30.062630" 
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label>{t('longitudeField')}</label>
                  <input 
                    type="number" 
                    step="0.000001"
                    className="input-field" 
                    placeholder="31.249670" 
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>{t('stopDescEnLabel')}</label>
                  <textarea 
                    className="input-field" 
                    rows="2" 
                    placeholder="E.g. Main junction hub..."
                    value={stopDescriptionEn}
                    onChange={(e) => setStopDescriptionEn(e.target.value)}
                    disabled={submitting}
                    style={{ resize: 'none' }}
                  ></textarea>
                </div>

                <div className="form-group">
                  <label>{t('stopDescArLabel')}</label>
                  <textarea 
                    className="input-field" 
                    rows="2" 
                    placeholder="درجة المحطة أو معلومات..."
                    value={stopDescriptionAr}
                    onChange={(e) => setStopDescriptionAr(e.target.value)}
                    disabled={submitting}
                    style={{ resize: 'none' }}
                  ></textarea>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={submitting || !stopCode.trim() || !stopNameEn.trim() || !stopNameAr.trim()}>
                {submitting ? t('loading') : t('submitStopSuggestion')}
              </button>
            </form>
          )}
        </div>

        {/* Suggestion History Panel */}
        <div className="glass-panel" style={{ padding: '32px', minHeight: '400px' }}>
          {/* Tab selector for logs */}
          <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', paddingBottom: '8px' }}>
            <button 
              onClick={() => setActiveLogTab('train')} 
              className={`btn ${activeLogTab === 'train' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px' }}
            >
              {t('trainSuggestionsLog')}
            </button>
            <button 
              onClick={() => setActiveLogTab('stop')} 
              className={`btn ${activeLogTab === 'stop' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px' }}
            >
              {t('stopSuggestionsLog')}
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
              <Clock className="animate-spin" size={24} color="var(--accent-primary)" />
            </div>
          ) : activeLogTab === 'train' ? (
            // TRAIN LOGS
            mySuggestions.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '40px' }}>
                {t('noSuggestionsYet')}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {mySuggestions.map((sug) => (
                  <div 
                    key={sug.id}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: 'rgba(120,120,120,0.01)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                        <span style={{ color: 'var(--accent-primary)', marginInlineEnd: '6px' }}>#{sug.trainNumber}</span>
                        {isRTL ? sug.nameAr : sug.nameEn}
                      </span>
                      {getStatusBadge(sug.status)}
                    </div>
                    
                    {sug.routeDescriptionEn && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        <strong>{isRTL ? 'المحطات:' : 'Stops:'}</strong> {sug.routeDescriptionEn}
                      </div>
                    )}

                    {sug.adminNotes && (
                      <div style={{ 
                        marginTop: '8px', 
                        padding: '8px 12px', 
                        background: 'rgba(245, 158, 11, 0.05)', 
                        border: '1px solid rgba(245, 158, 11, 0.1)', 
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: 'var(--warning)'
                      }}>
                        <strong>{t('adminNotes')}:</strong> {sug.adminNotes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            // STOP LOGS
            myStopSuggestions.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '40px' }}>
                {t('noStopSuggestionsYet')}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {myStopSuggestions.map((sug) => (
                  <div 
                    key={sug.id}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: 'rgba(120,120,120,0.01)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                        <span style={{ color: 'var(--accent-secondary)', marginInlineEnd: '6px' }}>[{sug.code}]</span>
                        {isRTL ? sug.nameAr : sug.nameEn}
                      </span>
                      {getStatusBadge(sug.status)}
                    </div>
                    
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>
                        <strong>{isRTL ? 'المدينة:' : 'City:'}</strong>{' '}
                        {sug.cityId 
                          ? (isRTL ? sug.cityNameAr : sug.cityNameEn)
                          : `${isRTL ? sug.newCityNameAr : sug.newCityNameEn} (${isRTL ? sug.newCityGovernorateNameAr : sug.newCityGovernorateNameEn} - ${isRTL ? 'مقترحة' : 'Suggested'})`
                        }
                      </div>
                      {sug.latitude && sug.longitude && (
                        <div>
                          <strong>{isRTL ? 'الإحداثيات:' : 'Coordinates:'}</strong> {sug.latitude.toFixed(6)}, {sug.longitude.toFixed(6)}
                        </div>
                      )}
                    </div>

                    {sug.adminNotes && (
                      <div style={{ 
                        marginTop: '8px', 
                        padding: '8px 12px', 
                        background: 'rgba(245, 158, 11, 0.05)', 
                        border: '1px solid rgba(245, 158, 11, 0.1)', 
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: 'var(--warning)'
                      }}>
                        <strong>{t('adminNotes')}:</strong> {sug.adminNotes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default Suggestions;
