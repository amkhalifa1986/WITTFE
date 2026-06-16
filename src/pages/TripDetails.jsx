import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import signalrService from '../services/signalrService';
import { useAuth } from '../context/authContext';
import { useLanguage } from '../context/LanguageContext';
import { usePopup } from '../context/PopupContext';
import { AdInterstitial } from '../components/AdInterstitial';
import L from 'leaflet';
import { 
  Train, 
  MapPin, 
  Clock, 
  Send, 
  Star,
  StarOff,
  Navigation,
  MessageSquare,
  Users,
  Bell,
  BellOff,
  ThumbsUp,
  Trash2,
  Calendar,
  ArrowRight
} from 'lucide-react';

export const TripDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();
  const { toast, alert, confirm } = usePopup();
  
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Update Form State
  const [content, setContent] = useState('');
  const [statusTag, setStatusTag] = useState('');
  const [crowdState, setCrowdState] = useState('');
  const [shareLocation, setShareLocation] = useState(false);
  const [submittingUpdate, setSubmittingUpdate] = useState(false);
  const [statusTagsList, setStatusTagsList] = useState([]);
  const [crowdLevelsList, setCrowdLevelsList] = useState([]);

  // Telemetry Snapping & Geolocation sharing
  const [liveTelemetry, setLiveTelemetry] = useState(null);
  const [passengerMode, setPassengerMode] = useState(false);
  const [isAutoCentering, setIsAutoCentering] = useState(true);
  const [hasSetInitialBounds, setHasSetInitialBounds] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [showStartPrompt, setShowStartPrompt] = useState(true);
  const [showEndPrompt, setShowEndPrompt] = useState(true);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const trainMarkerRef = useRef(null);
  const stopMarkersRef = useRef([]);
  const polylineRef = useRef(null);

  const handleRecenter = () => {
    setIsAutoCentering(true);
    if (mapInstanceRef.current && liveTelemetry && liveTelemetry.snappedLatitude && liveTelemetry.snappedLongitude) {
      const pos = [liveTelemetry.snappedLatitude, liveTelemetry.snappedLongitude];
      mapInstanceRef.current.setView(pos, 15);
    }
  };

  const fetchTripDetails = async () => {
    try {
      const res = await api.getTripDetails(id);
      setTrip(res.data);
    } catch (err) {
      console.error(err);
      setError(t('Failed to retrieve trip details.'));
    } finally {
      setLoading(false);
    }
  };



  const fetchLookups = async () => {
    try {
      const [tagsRes, crowdRes] = await Promise.all([
        api.getStatusTags(),
        api.getCrowdLevels()
      ]);
      setStatusTagsList(tagsRes.data || []);
      setCrowdLevelsList(crowdRes.data || []);
    } catch (err) {
      console.error('Failed to fetch lookup data:', err);
    }
  };

  useEffect(() => {
    fetchTripDetails();
    fetchLookups();
    setIsAutoCentering(true);

    const fetchTracking = async () => {
      try {
        const res = await api.getTripTracking(id);
        if (res.isSuccess && res.data) {
          setLiveTelemetry(res.data);
        }
      } catch (err) {
        console.error('Failed to get initial trip tracking:', err);
      }
    };
    fetchTracking();
    
    const initSignalR = async () => {
      try {
        await signalrService.joinTrip(id);
      } catch (err) {
        console.error('SignalR failed to join group:', err);
      }
    };
    initSignalR();

    const unsubscribe = signalrService.registerListener((update) => {
      setTrip((prevTrip) => {
        if (!prevTrip) return null;
        const updateId = update.id || update.Id;
        if (prevTrip.recentUpdates?.some(u => (u.id || u.Id) === updateId)) return prevTrip;

        let updatedStatus = prevTrip.status;
        if (!update.authorId && update.statusTag) {
          const validStatuses = ['Scheduled', 'Departed', 'InTransit', 'Arrived', 'Cancelled', 'Delayed'];
          const matched = validStatuses.find(s => s.toLowerCase() === update.statusTag.toLowerCase());
          if (matched) {
            updatedStatus = matched;
          }
        }

        return {
          ...prevTrip,
          status: updatedStatus,
          recentUpdates: [update, ...(prevTrip.recentUpdates || [])]
        };
      });
    });

    const unsubscribeLocation = signalrService.registerLocationListener((locationUpdate) => {
      setLiveTelemetry(locationUpdate);
    });

    return () => {
      signalrService.leaveTrip(id).catch(err => console.error(err));
      unsubscribe();
      unsubscribeLocation();
    };
  }, [id]);

  // Leaflet Map Rendering & Updates
  useEffect(() => {
    if (!trip) return;

    if (!mapInstanceRef.current && mapRef.current) {
      if (mapRef.current._leaflet_id) {
        return; // Avoid double initialization error
      }

      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true
      }).setView([26.8206, 30.8025], 6);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20
      }).addTo(mapInstanceRef.current);

      // Disable auto-centering when user manually pans/zooms the map
      mapInstanceRef.current.on('movestart', (e) => {
        if (e.originalEvent) {
          setIsAutoCentering(false);
        }
      });
      setMapReady(true);
    }

    const map = mapInstanceRef.current;
    if (!map) return;
    map.invalidateSize();


    // Drawing route polyline — only use routePath from the backend (no runtime straight-line fallback)
    const polylineCoords = (trip.routePath && trip.routePath.length > 0) ? trip.routePath : null;

    if (polylineCoords && polylineCoords.length > 1) {
      if (!polylineRef.current) {
        polylineRef.current = L.polyline(polylineCoords, {
          color: '#3b82f6',
          weight: 5,
          opacity: 0.45,
          smoothFactor: 1.5,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);
      } else {
        polylineRef.current.setLatLngs(polylineCoords);
      }
    } else {
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
    }

    // 2. Plot stops as dots on the track
    if (stopMarkersRef.current.length === 0 && trip.routeStops) {
      trip.routeStops.forEach(stop => {
        const stopIcon = L.divIcon({
          className: 'custom-stop-marker',
          html: `<div class="stop-dot"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        });

        const marker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: Outfit, sans-serif; padding: 4px;">
              <h4 style="margin: 0; color: var(--text-primary); font-size: 0.95rem;">${isRTL ? stop.stopNameAr : stop.stopNameEn}</h4>
              <p style="margin: 4px 0 0 0; color: var(--text-secondary); font-size: 0.8rem;">${isRTL ? stop.stopNameEn : stop.stopNameAr} (${stop.stopCode})</p>
            </div>
          `);
        
        stopMarkersRef.current.push(marker);
      });
    }

    // 3. PlotSnapped train marker & center view
    if (liveTelemetry && liveTelemetry.snappedLatitude && liveTelemetry.snappedLongitude) {
      const pos = [liveTelemetry.snappedLatitude, liveTelemetry.snappedLongitude];
      const markerUrl = trip.markerPngUrl ? `http://localhost:5245${trip.markerPngUrl}` : '/train-marker.png';
      const trainIcon = L.divIcon({
        className: 'custom-train-marker-pin',
        html: `<div class="train-pulse-pin"></div><img src="${markerUrl}" style="width: 56px; height: 56px; display: block; object-fit: contain;" alt="Train Pin" />`,
        iconSize: [56, 56],
        iconAnchor: [28, 56],
        popupAnchor: [0, -56]
      });

      if (!trainMarkerRef.current) {
        trainMarkerRef.current = L.marker(pos, { icon: trainIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: Outfit, sans-serif; padding: 4px; text-align: center;">
              <h4 style="margin: 0; color: var(--text-primary); font-size: 0.95rem;">Train ${trip.trainNumber}</h4>
              <p style="margin: 4px 0 0 0; color: var(--text-secondary); font-size: 0.8rem;">Speed: ${(liveTelemetry.speed || 0).toFixed(1)} km/h</p>
            </div>
          `);
      } else {
        trainMarkerRef.current.setLatLng(pos);
        trainMarkerRef.current.setIcon(trainIcon);
        trainMarkerRef.current.setPopupContent(`
          <div style="font-family: Outfit, sans-serif; padding: 4px; text-align: center;">
            <h4 style="margin: 0; color: var(--text-primary); font-size: 0.95rem;">Train ${trip.trainNumber}</h4>
            <p style="margin: 4px 0 0 0; color: var(--text-secondary); font-size: 0.8rem;">Speed: ${(liveTelemetry.speed || 0).toFixed(1)} km/h</p>
          </div>
        `);
      }
    } else {
      // Clean up train marker from the map if it was previously rendered
      if (trainMarkerRef.current) {
        trainMarkerRef.current.remove();
        trainMarkerRef.current = null;
      }
    }

    // Set initial bounds of map view to fit either the polyline route or route stops
    if (!hasSetInitialBounds) {
      if (polylineRef.current) {
        map.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40] });
        setHasSetInitialBounds(true);
      } else if (trip.routeStops && trip.routeStops.length > 0) {
        const coords = trip.routeStops.map(s => [s.latitude, s.longitude]);
        if (coords.length > 0) {
          map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
          setHasSetInitialBounds(true);
        }
      }
    }
  }, [trip, liveTelemetry, hasSetInitialBounds, loading]);

  // Handle auto-centering viewport separately to prevent non-location updates from triggering recenter
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (isAutoCentering && liveTelemetry && liveTelemetry.snappedLatitude && liveTelemetry.snappedLongitude) {
      const pos = [liveTelemetry.snappedLatitude, liveTelemetry.snappedLongitude];
      map.setView(pos, 15);
    }
  }, [liveTelemetry, isAutoCentering, mapReady]);

  // Cleanup Map on Unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      trainMarkerRef.current = null;
      stopMarkersRef.current = [];
      polylineRef.current = null;
    };
  }, []);

  // Passenger GPS Telemetry Broadcast Interval
  useEffect(() => {
    let watchId = null;
    let intervalId = null;

    if (passengerMode) {
      if (navigator.geolocation) {
        let lastCoords = null;
        
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            lastCoords = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              speed: pos.coords.speed || 0
            };
          },
          (err) => {
            console.error('Geolocation watch error:', err);
          },
          { enableHighAccuracy: true }
        );

        intervalId = setInterval(async () => {
          if (lastCoords) {
            try {
              const res = await api.submitTelemetry(
                id, 
                lastCoords.latitude, 
                lastCoords.longitude, 
                lastCoords.speed
              );
              
              if (res.isSuccess && res.data) {
                setLiveTelemetry(res.data);
              }
            } catch (err) {
              console.error('Failed to submit passenger telemetry:', err);
            }
          }
        }, 10000);
      } else {
        toast(t('geolocationNotSupported'), 'error');
        setPassengerMode(false);
      }
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [passengerMode, id]);

  const handleToggleFollow = async () => {
    if (!trip) return;
    try {
      if (trip.isFollowedByCurrentUser) {
        await api.unfollowTrip(trip.id);
        setTrip(prev => prev ? { ...prev, isFollowedByCurrentUser: false, followerCount: prev.followerCount - 1 } : null);
      } else {
        await api.followTrip(trip.id);
        setTrip(prev => prev ? { ...prev, isFollowedByCurrentUser: true, followerCount: prev.followerCount + 1 } : null);
      }
    } catch (err) {
      toast('Failed to update follow status: ' + err.message, 'error');
    }
  };

  const handleToggleThanks = async (updateId) => {
    try {
      const res = await api.toggleReportThanks(updateId);
      if (res.isSuccess && res.data) {
        const { thanksCount, isThanked } = res.data;
        setTrip(prev => {
          if (!prev) return null;
          return {
            ...prev,
            recentUpdates: prev.recentUpdates.map(u => 
              u.id === updateId 
                ? { ...u, thanksCount, isThankedByCurrentUser: isThanked } 
                : u
            )
          };
        });
      }
    } catch (err) {
      console.error('Failed to toggle thanks:', err);
    }
  };

  const handleRequestRemoval = async (updateId) => {
    const isConfirmed = await confirm(t('confirmRequestRemoval'));
    if (!isConfirmed) return;
    try {
      const res = await api.requestLiveUpdateRemoval(updateId);
      if (res.isSuccess) {
        setTrip(prev => {
          if (!prev) return null;
          return {
            ...prev,
            recentUpdates: prev.recentUpdates.filter(u => u.id !== updateId)
          };
        });
        toast(t('Removal request submitted.'), 'success');
      }
    } catch (err) {
      toast(err.message || 'Failed to request removal', 'error');
    }
  };


  const handlePostUpdate = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmittingUpdate(true);
    let coords = { latitude: null, longitude: null };

    const submitData = async () => {
      try {
        const res = await api.postTripLiveUpdate(
          trip.id,
          content,
          statusTag || null,
          crowdState || null,
          coords.latitude,
          coords.longitude
        );

        const savedUpdate = res.data;

        const newUpdate = {
          id: savedUpdate.id,
          authorId: user.id,
          authorName: user.displayName,
          authorAvatarUrl: user.avatarUrl,
          content: content,
          statusTag: statusTag || null,
          crowdState: crowdState || null,
          latitude: coords.latitude,
          longitude: coords.longitude,
          createdAt: new Date().toISOString()
        };

        setTrip(prev => prev ? {
          ...prev,
          recentUpdates: [newUpdate, ...(prev.recentUpdates || [])]
        } : null);

        setContent('');
        setStatusTag('');
        setCrowdState('');
        setShareLocation(false);
        toast(isRTL ? 'تم نشر التحديث بنجاح' : 'Update posted successfully', 'success');
      } catch (err) {
        toast((isRTL ? 'فشل في إرسال التحديث: ' : 'Failed to submit update: ') + err.message, 'error');
      } finally {
        setSubmittingUpdate(false);
      }
    };

    if (shareLocation) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            coords.latitude = pos.coords.latitude;
            coords.longitude = pos.coords.longitude;
            submitData();
          },
          (err) => {
            console.error('Geo error', err);
            toast(t('locationSharingFailedCoords'), 'error');
            submitData();
          }
        );
      } else {
        toast(t('geolocationNotSupportedSubmitting'), 'error');
        submitData();
      }
    } else {
      submitData();
    }
  };

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
        return { background: '#3b82f6', color: '#ffffff', border: '1px solid #3b82f6', fontWeight: '600' };
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
        return { background: '#9ca3af', color: '#ffffff', border: '1px solid #9ca3af' };
      default:
        return { background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff', border: '1px solid var(--border-color)' };
    }
  };

  const getCrowdTagStyle = (crowd) => {
    switch (crowd?.toLowerCase()) {
      case 'aislecrowded':
      case 'crowded':
        return { background: '#ef4444', color: '#ffffff', border: '1px solid #ef4444' };
      case 'fullchairs':
        return { background: '#9ca3af', color: '#ffffff', border: '1px solid #9ca3af' };
      case 'emptychairs':
      case 'empty':
        return { background: '#10b981', color: '#ffffff', border: '1px solid #10b981' };
      default:
        return { background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff', border: '1px solid var(--border-color)' };
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <Clock className="animate-spin" size={32} color="var(--accent-primary)" />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <p>{error || t('noStopsInfo')}</p>
        <button onClick={() => navigate('/')} className="btn btn-primary" style={{ marginTop: '20px' }}>
          {isRTL ? 'الرجوع' : 'Back'}
        </button>
      </div>
    );
  }

  const totalStops = trip.routeStops?.length || 0;
  let currentStopOrder = 0;

  if (liveTelemetry && liveTelemetry.upcomingStops && liveTelemetry.upcomingStops.length > 0) {
    const firstUpcoming = trip.routeStops?.find(rs => rs.stopId === liveTelemetry.upcomingStops[0].stopId);
    if (firstUpcoming) {
      currentStopOrder = firstUpcoming.stopOrder - 1;
    }
  }

  if (currentStopOrder === 0) {
    const lastAtStationUpdate = trip.recentUpdates?.find(u => u.statusTag === 'AtStation');
    if (lastAtStationUpdate) {
      const matchedStop = trip.routeStops?.find(rs => 
        lastAtStationUpdate.content.toLowerCase().includes(rs.stopNameEn.toLowerCase()) || 
        lastAtStationUpdate.content.includes(rs.stopNameAr)
      );
      if (matchedStop) currentStopOrder = matchedStop.stopOrder;
    }
  }

  if (currentStopOrder === 0 && totalStops > 0) {
    if (trip.status === 'Arrived') {
      currentStopOrder = totalStops;
    } else if (trip.status === 'Departed' || trip.status === 'InTransit') {
      currentStopOrder = Math.ceil(totalStops / 2);
    } else {
      currentStopOrder = 1;
    }
  }

  const isInactive = trip && (
    trip.status?.toLowerCase() === 'arrived' ||
    trip.status?.toLowerCase() === 'cancelled' ||
    trip.status?.toLowerCase() === 'ended' ||
    trip.status?.toLowerCase() === 'canceled'
  );

  const tripHasStarted = trip && (
    trip.status?.toLowerCase() === 'departed' || 
    trip.status?.toLowerCase() === 'intransit' || 
    trip.status?.toLowerCase() === 'active' ||
    (liveTelemetry && liveTelemetry.snappedLatitude > 0)
  );



  const handleConfirmStart = async () => {
    try {
      const res = await api.updateTripStatus(trip.id, 2);
      if (res.isSuccess) {
        setTrip(prev => prev ? { ...prev, status: 'InTransit' } : null);
        setShowStartPrompt(false);
        setPassengerMode(true);
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
              const telemetryRes = await api.submitTelemetry(
                trip.id,
                pos.coords.latitude,
                pos.coords.longitude,
                pos.coords.speed || 0
              );
              if (telemetryRes.isSuccess && telemetryRes.data) {
                setLiveTelemetry(telemetryRes.data);
              }
            } catch (telemetryErr) {
              console.error('Initial telemetry submission error:', telemetryErr);
            }
          });
        }
      }
    } catch (err) {
      toast((isRTL ? 'فشل في تحديث حالة الرحلة: ' : 'Failed to update trip status: ') + err.message, 'error');
    }
  };

  const handleConfirmEnd = async () => {
    try {
      const res = await api.updateTripStatus(trip.id, 3);
      if (res.isSuccess) {
        setTrip(prev => prev ? { ...prev, status: 'Arrived' } : null);
        setShowEndPrompt(false);
        setPassengerMode(false);
      }
    } catch (err) {
      toast((isRTL ? 'فشل في تحديث حالة الرحلة: ' : 'Failed to update trip status: ') + err.message, 'error');
    }
  };

  const handleDismissStart = () => setShowStartPrompt(false);
  const handleDismissEnd = () => setShowEndPrompt(false);

  let departurePassed = false;
  let arrivalPassed = false;

  if (trip && trip.routeStops && trip.routeStops.length > 0) {
    const firstStop = trip.routeStops[0];
    const lastStop = trip.routeStops[trip.routeStops.length - 1];

    if (firstStop.scheduledDeparture && lastStop.scheduledArrival) {
      const getEgyptTime = () => {
        const options = {
          timeZone: 'Africa/Cairo',
          year: 'numeric', month: 'numeric', day: 'numeric',
          hour: 'numeric', minute: 'numeric', second: 'numeric',
          hour12: false
        };
        const formatter = new Intl.DateTimeFormat('en-US', options);
        const parts = formatter.formatToParts(new Date());
        const getPart = (type) => parts.find(p => p.type === type).value;
        let hour = parseInt(getPart('hour'));
        if (hour === 24) hour = 0;
        return new Date(
          parseInt(getPart('year')),
          parseInt(getPart('month')) - 1,
          parseInt(getPart('day')),
          hour,
          parseInt(getPart('minute')),
          parseInt(getPart('second'))
        );
      };

      try {
        const nowEgypt = getEgyptTime();
        const [year, month, day] = trip.tripDate.split('-').map(Number);
        
        let scheduledStart = null;
        let scheduledEnd = null;
        let currentDayOffset = 0;
        let lastSeconds = -1;

        const toSeconds = (timeStr) => {
          if (!timeStr) return null;
          const [h, m, s] = timeStr.split(':').map(Number);
          return h * 3600 + m * 60 + (s || 0);
        };

        trip.routeStops.forEach((stop, index) => {
          const arrSec = toSeconds(stop.scheduledArrival);
          const depSec = toSeconds(stop.scheduledDeparture);

          if (index === 0) {
            if (depSec !== null) {
              scheduledStart = new Date(year, month - 1, day, Math.floor(depSec / 3600), Math.floor((depSec % 3600) / 60), depSec % 60);
              lastSeconds = depSec;
            }
          } else {
            if (arrSec !== null) {
              if (arrSec < lastSeconds) {
                currentDayOffset += 1;
              }
              lastSeconds = arrSec;
              if (index === trip.routeStops.length - 1) {
                scheduledEnd = new Date(year, month - 1, day + currentDayOffset, Math.floor(arrSec / 3600), Math.floor((arrSec % 3600) / 60), arrSec % 60);
              }
            }
            if (depSec !== null) {
              if (depSec < lastSeconds) {
                currentDayOffset += 1;
              }
              lastSeconds = depSec;
            }
          }
        });

        if (scheduledStart) {
          departurePassed = nowEgypt > scheduledStart;
        }
        if (scheduledEnd) {
          arrivalPassed = nowEgypt > scheduledEnd;
        }
      } catch (err) {
        console.error('Time comparison error:', err);
      }
    }
  }

  const showStartPromptBanner = trip && trip.isFollowedByCurrentUser && departurePassed && showStartPrompt && 
    (trip.status?.toLowerCase() === 'scheduled' || trip.status?.toLowerCase() === 'delayed');

  const showEndPromptBanner = trip && trip.isFollowedByCurrentUser && arrivalPassed && showEndPrompt && 
    (trip.status?.toLowerCase() === 'intransit' || trip.status?.toLowerCase() === 'departed');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <AdInterstitial pageKey="tripDetails" trainNumber={trip.trainNumber} />
      {/* Header Info Banner */}
      <div className="glass-panel" style={{ padding: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            background: 'var(--accent-gradient)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: 800,
            fontFamily: 'Outfit'
          }}>
            {trip.trainNumber}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {isRTL ? trip.trainNameAr : trip.trainNameEn}
              </h1>
              <span className={`badge ${getStatusBadgeClass(trip.status)}`}>{t(trip.status)}</span>
              {(isRTL ? trip.trainTypeNameAr : trip.trainTypeNameEn) && (
                <span className="badge badge-info" style={{ textTransform: 'none' }}>
                  {isRTL ? trip.trainTypeNameAr : trip.trainTypeNameEn}
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>{t('trackDate')}: {trip.tripDate}</span>
              <span>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Users size={14} /> {trip.followerCount} {t('statUsers')}
              </span>
            </p>
          </div>
        </div>

        {!isInactive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {trip.isFollowedByCurrentUser && (
              <button 
                onClick={async () => {
                  const enabled = !trip.isNotificationsEnabled;
                  try {
                    await api.toggleTripNotifications(trip.id, enabled);
                    setTrip(prev => prev ? { ...prev, isNotificationsEnabled: enabled } : null);
                  } catch (err) {
                    toast('Failed to update notification preferences: ' + err.message, 'error');
                  }
                }} 
                className={`btn ${trip.isNotificationsEnabled ? 'btn-primary' : 'btn-secondary'}`}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {trip.isNotificationsEnabled ? (
                  <>
                    <Bell size={16} /> {t('turnOffNotifications')}
                  </>
                ) : (
                  <>
                    <BellOff size={16} /> {t('turnOnNotifications')}
                  </>
                )}
              </button>
            )}

            <button 
              onClick={handleToggleFollow} 
              className={`btn ${trip.isFollowedByCurrentUser ? 'btn-secondary' : 'btn-primary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {trip.isFollowedByCurrentUser ? (
                <>
                  <StarOff size={16} /> {t('unfollowTrip')}
                </>
              ) : (
                <>
                  <Star size={16} /> {t('followTrip')}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Follower Prompts */}
      {showStartPromptBanner && (
        <div className="glass-panel" style={{
          padding: '24px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(244, 63, 94, 0.05) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px 0 rgba(99, 102, 241, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '280px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(99, 102, 241, 0.25)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(99, 102, 241, 0.4)'
            }}>
              <Clock size={24} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                {t('isTripStartedQuestion')}
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                {t('isTripStartedSub')}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={handleConfirmStart} 
              className="btn btn-primary"
              style={{
                padding: '10px 24px',
                fontSize: '0.85rem',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                cursor: 'pointer'
              }}
            >
              {t('yes')}
            </button>
            <button 
              onClick={handleDismissStart} 
              className="btn btn-secondary"
              style={{
                padding: '10px 24px',
                fontSize: '0.85rem',
                fontWeight: 700,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer'
              }}
            >
              {t('notYet')}
            </button>
          </div>
        </div>
      )}

      {showEndPromptBanner && (
        <div className="glass-panel" style={{
          padding: '24px',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px 0 rgba(16, 185, 129, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '280px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.25)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)'
            }}>
              <MapPin size={24} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                {t('isTripEndedQuestion')}
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                {t('isTripEndedSub')}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={handleConfirmEnd} 
              className="btn btn-primary"
              style={{
                padding: '10px 24px',
                fontSize: '0.85rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                cursor: 'pointer'
              }}
            >
              {t('yes')}
            </button>
            <button 
              onClick={handleDismissEnd} 
              className="btn btn-secondary"
              style={{
                padding: '10px 24px',
                fontSize: '0.85rem',
                fontWeight: 700,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer'
              }}
            >
              {t('notYet')}
            </button>
          </div>
        </div>
      )}

      {/* Main Content Layout Grid */}
      <div className="dashboard-grid trip-details-grid">
        {/* Left Side: Map & Timeline side-by-side */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Navigation size={20} color="var(--accent-primary)" /> {t('liveRouteTracking')}
          </h3>

          <div className="tracking-workspace" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {/* Column 1: Map and Controls */}
            <div>
              {/* Map Container Wrapper */}
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <div ref={mapRef} className="map-container" style={{ height: '580px', marginBottom: 0 }}>
                </div>

                {/* Floating Re-center Button (Google Maps Style) - bottom left corner, always enabled */}
                {liveTelemetry && liveTelemetry.snappedLatitude > 0 && (
                  <button 
                    onClick={handleRecenter}
                    className="btn"
                    style={{
                      position: 'absolute',
                      bottom: '16px',
                      left: '16px',
                      zIndex: 1000,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(12px)',
                      background: 'var(--accent-gradient)',
                      color: '#ffffff',
                      cursor: 'pointer',
                      opacity: 1,
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <Navigation size={14} style={{ transform: 'rotate(45deg)', fill: 'currentColor' }} />
                    {t('recenter') || 'Re-center'}
                  </button>
                )}
              </div>

              {/* Map Live HUD Panel */}
              {liveTelemetry && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(120,120,120,0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: 'var(--success)',
                      display: 'inline-block',
                      boxShadow: '0 0 8px var(--success)',
                      animation: 'pulseGlow 1.5s infinite'
                    }}></span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {t('liveGpsSnappingActive') || 'Live Snapped Tracking Active'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {t('speedometer') || 'Speed'}: <strong style={{ color: 'var(--accent-secondary)' }}>{(liveTelemetry.speed || 0).toFixed(0)} km/h</strong>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {t('upcomingStopsCount') || 'Stops Remaining'}: <strong style={{ color: 'var(--text-primary)' }}>{liveTelemetry.upcomingStops?.length || 0}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Passenger Sharing Telemetry Switch */}
              {!isInactive && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(99, 102, 241, 0.04)',
                  border: '1px dashed rgba(99, 102, 241, 0.25)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '20px'
                }}>
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {t('passengerModeTitle') || 'Passenger Mode (Share GPS)'}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {t('passengerModeSub') || 'Broadcast your location to improve live ETA snapping for all users.'}
                    </p>
                  </div>
                  <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px' }}>
                    <input 
                      type="checkbox" 
                      checked={passengerMode}
                      onChange={(e) => setPassengerMode(e.target.checked)}
                      style={{
                        opacity: 0,
                        width: 0,
                        height: 0
                      }}
                    />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: passengerMode ? 'var(--accent-primary)' : 'var(--border-color)',
                      transition: '0.4s',
                      borderRadius: '20px'
                    }}>
                      <span style={{
                        position: 'absolute',
                        content: '""',
                        height: '14px', width: '14px',
                        left: passengerMode ? '22px' : '3px',
                        bottom: '3px',
                        backgroundColor: 'white',
                        transition: '0.4s',
                        borderRadius: '50%'
                      }}></span>
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Column 2: Stops Timeline Sequence (Scrollable) */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={18} color="var(--accent-secondary)" /> {t('stopsSequence') || 'Stops Sequence'}
              </h4>
              <div style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '8px', position: 'relative' }}>
                <div className="trip-timeline" style={{ marginTop: 0 }}>
                  {trip.routeStops?.map((stop) => {
                    const isPassed = stop.stopOrder < currentStopOrder;
                    const isCurrent = stop.stopOrder === currentStopOrder;
                    
                    return (
                      <div key={stop.stopId} className={`timeline-item ${isPassed ? 'passed' : ''} ${isCurrent ? 'current' : ''}`}>
                        <div className="timeline-node"></div>
                        <div className="timeline-content">
                          <div className="station-details">
                            <div className="station-name">{isRTL ? stop.stopNameAr : stop.stopNameEn}</div>
                            <div className="station-info">{isRTL ? stop.stopNameEn : stop.stopNameAr} ({stop.stopCode})</div>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span className="station-time">
                              {stop.scheduledArrival && <span>{isRTL ? 'وصول' : 'Arr'}: {stop.scheduledArrival.slice(0, 5)}</span>}
                              {stop.scheduledDeparture && <span style={{ marginInlineStart: '8px' }}>{isRTL ? 'تحرك' : 'Dep'}: {stop.scheduledDeparture.slice(0, 5)}</span>}
                            </span>


                            
                            {isCurrent && (
                              <span className="badge badge-on-time" style={{ fontSize: '0.6rem', marginTop: '4px', background: 'rgba(16, 185, 129, 0.2)' }}>
                                {t('currentLastStation')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Updates */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Submit Update */}
          {!isInactive && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MessageSquare size={18} color="var(--accent-secondary)" /> {t('shareTrainUpdate')}
              </h3>

              {!trip.isFollowedByCurrentUser ? (
                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)' }}>
                  <p style={{ fontSize: '0.9rem' }}>
                    {isRTL ? 'يجب عليك متابعة هذه الرحلة لتتمكن من كتابة تحديث مباشر.' : 'You must follow this trip to post a live update.'}
                  </p>
                  <button 
                    onClick={handleToggleFollow} 
                    className="btn btn-primary" 
                    style={{ marginTop: '12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    type="button"
                  >
                    <Star size={14} />
                    {t('followTrip')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePostUpdate}>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <textarea 
                      className="input-field" 
                      rows="3" 
                      placeholder={t('whatIsHappening')}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      style={{ resize: 'none', fontFamily: 'inherit' }}
                      required
                      disabled={submittingUpdate}
                    ></textarea>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.75rem', marginBottom: '4px' }}>{t('statusTag')}</label>
                      <select 
                        className="input-field" 
                        value={statusTag}
                        onChange={(e) => setStatusTag(e.target.value)}
                        style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                        disabled={submittingUpdate}
                      >
                        <option value="">{t('noStatusTag')}</option>
                        {statusTagsList.map(tag => (
                          <option key={tag.id} value={tag.code}>
                            {t(tag.code) !== tag.code ? t(tag.code) : (isRTL ? tag.nameAr : tag.nameEn)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.75rem', marginBottom: '4px' }}>{t('crowdLevel')}</label>
                      <select 
                        className="input-field" 
                        value={crowdState}
                        onChange={(e) => setCrowdState(e.target.value)}
                        style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                        disabled={submittingUpdate}
                      >
                        <option value="">{t('noCrowdTag')}</option>
                        {crowdLevelsList.map(level => (
                          <option key={level.id} value={level.code}>
                            {t(level.code) !== level.code ? t(level.code) : (isRTL ? level.nameAr : level.nameEn)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={shareLocation}
                        onChange={(e) => setShareLocation(e.target.checked)}
                        style={{ accentColor: 'var(--accent-secondary)' }}
                        disabled={submittingUpdate}
                      />
                      {t('shareGps')}
                    </label>

                    <button 
                      type="submit" 
                      className="btn btn-primary" 
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                      disabled={submittingUpdate || !content.trim()}
                    >
                      {t('send')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Feed */}
          <div className="glass-panel" style={{ padding: '24px', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={18} color="var(--accent-primary)" /> {t('livePassengerReports')}
            </h3>

            <div style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '400px', paddingRight: '4px' }}>
              {!trip.recentUpdates || trip.recentUpdates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 10px', color: 'var(--text-muted)' }}>
                  <MessageSquare size={32} style={{ marginBottom: '12px', opacity: 0.2 }} />
                  <p style={{ fontSize: '0.85rem' }}>{t('noLiveReports')}</p>
                </div>
              ) : (
                <div className="update-feed">
                  {trip.recentUpdates.map((update) => (
                    <div key={update.id} className="feed-item" style={{ background: 'rgba(120,120,120,0.01)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '12px' }}>
                      {/* First Row: Avatar - Name - Time (Time moved to top right) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="feed-avatar" style={{ background: 'var(--accent-primary)', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#ffffff', fontSize: '0.75rem' }}>
                            {update.authorName ? update.authorName[0].toUpperCase() : 'P'}
                          </div>
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{update.authorName}</span>
                        </div>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                          {update.createdAt && !isNaN(new Date(update.createdAt).getTime()) 
                            ? new Date(update.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </span>
                      </div>

                      {/* Second Row: Body - Like Icon or Ask to Remove Icon based on ownership */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '10px 0', gap: '16px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4', flexGrow: 1 }}>
                          {update.content}
                        </div>
                        {user && user.id === update.authorId ? (
                          /* My post: show ask to remove (32x32 colored 3D icon), hide like */
                          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                            {update.isRemovalRequested ? (
                              <span 
                                className="btn-3d-pending"
                                title={t('removalPending')}
                              >
                                <Clock size={16} />
                              </span>
                            ) : (
                              <button
                                onClick={() => handleRequestRemoval(update.id)}
                                className="btn-3d-remove"
                                title={t('askToRemove')}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ) : (
                          /* Others' posts: show like (32x32 colored 3D icon + count), hide ask to remove */
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: update.isThankedByCurrentUser ? '#3b82f6' : 'var(--text-secondary)' }}>
                              {update.thanksCount || 0}
                            </span>
                            <button
                              onClick={() => handleToggleThanks(update.id)}
                              className={`btn-3d-like ${update.isThankedByCurrentUser ? 'liked' : ''}`}
                              title={t('like')}
                            >
                              <ThumbsUp size={16} style={{ fill: update.isThankedByCurrentUser ? '#ffffff' : 'none' }} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Third Row: Status tag - crowd level tag - map pin tag (Pin moved under the like icon area) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          {update.statusTag && (
                            <span className="badge" style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', fontWeight: '600', ...getStatusTagStyle(update.statusTag) }}>
                              {t(update.statusTag)}
                            </span>
                          )}
                          {update.crowdState && (
                            <span className="badge" style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', fontWeight: '600', ...getCrowdTagStyle(update.crowdState) }}>
                              {t(update.crowdState)}
                            </span>
                          )}
                        </div>
                        {update.latitude && update.longitude && (
                          <a 
                            href={`https://maps.google.com/?q=${update.latitude},${update.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-3d-pin"
                            title={t('gpsMapPin')}
                            style={{ display: 'inline-flex', flexShrink: 0 }}
                          >
                            <MapPin size={16} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripDetails;
