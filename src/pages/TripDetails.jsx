import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import api from '../services/api';
import signalrService from '../services/signalrService';
import { useAuth } from '../context/authContext';
import { useLanguage } from '../context/LanguageContext';
import { usePopup } from '../context/PopupContext';
import { useSettings } from '../context/SettingsContext';
import { AdInterstitial } from '../components/AdInterstitial';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
  ArrowRight,
  Trophy,
  Medal,
  X,
  MoreHorizontal
} from 'lucide-react';

const getEgyptTime = () => {
  const options = { timeZone: 'Africa/Cairo', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' };
  return new Date().toLocaleTimeString('en-US', options);
};

const getEgyptDateStr = () => {
  const options = { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(new Date());
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
};

export const TripDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const promptStopId = searchParams.get('promptStopId');

  const { user } = useAuth();
  const { t, isRTL } = useLanguage();
  const { toast, alert, confirm } = usePopup();
  const { settings } = useSettings();
  const gpsTrackingEnabled = settings?.gpsTrackingEnabled !== false;
  
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Arrived Prompt Popup States
  const [showArrivedPopup, setShowArrivedPopup] = useState(false);
  const [promptContent, setPromptContent] = useState('');
  const [promptStatusTag, setPromptStatusTag] = useState('');
  const [promptCrowdState, setPromptCrowdState] = useState('');
  const [promptShareLocation, setPromptShareLocation] = useState(false);
  const [submittingPrompt, setSubmittingPrompt] = useState(false);

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
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [leaderboardParticipants, setLeaderboardParticipants] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  // Confirmed stop order: set when a passenger manually confirms a stop via the prompt.
  // Prevents the sequence from flickering back to a stale value during re-fetch.
  const [confirmedStopOrder, setConfirmedStopOrderState] = useState(() => {
    const saved = sessionStorage.getItem(`confirmed_stop_order_${id}`);
    return saved ? parseInt(saved, 10) : 0;
  });

  const setConfirmedStopOrder = (order) => {
    setConfirmedStopOrderState(order);
    sessionStorage.setItem(`confirmed_stop_order_${id}`, order.toString());
  };
  const timelineRef = useRef(null);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const trainMarkerRef = useRef(null);
  const stopMarkersRef = useRef([]);
  const polylineRef = useRef(null);

  const rightColumnRef = useRef(null);
  const [rightColumnHeight, setRightColumnHeight] = useState(560);

  useEffect(() => {
    if (!rightColumnRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const height = entry.target.offsetHeight;
        if (height > 0) {
          setRightColumnHeight(height);
        }
      }
    });

    resizeObserver.observe(rightColumnRef.current);

    const initialHeight = rightColumnRef.current.offsetHeight;
    if (initialHeight > 0) {
      setRightColumnHeight(initialHeight);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [trip]);

  useEffect(() => {
    if (!trip || !trip.isFollowedByCurrentUser) return;

    // Cairo local timezone time calculations to compute departurePassed and arrivalPassed
    let departurePassed = false;
    let arrivalPassed = false;

    if (trip.routeStops && trip.routeStops.length > 0) {
      const sortedStops = [...trip.routeStops].sort((a, b) => a.stopOrder - b.stopOrder);
      const firstStop = sortedStops[0];
      const lastStop = sortedStops[sortedStops.length - 1];

      if (firstStop.scheduledDeparture && lastStop.scheduledArrival) {
        try {
          const getEgyptDateTime = () => {
            const options = {
              timeZone: 'Africa/Cairo',
              year: 'numeric', month: 'numeric', day: 'numeric',
              hour: 'numeric', minute: 'numeric', second: 'numeric',
              hour12: false
            };
            try {
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
            } catch (e) {
              return new Date();
            }
          };

          const nowEgypt = getEgyptDateTime();
          const [tripYear, tripMonth, tripDay] = trip.tripDate.split('-').map(Number);
          
          let scheduledStart = null;
          let scheduledEnd = null;
          let currentDayOffset = 0;
          let lastSeconds = -1;

          const toSeconds = (timeStr) => {
            if (!timeStr) return null;
            const [h, m, s] = timeStr.split(':').map(Number);
            return h * 3600 + m * 60 + (s || 0);
          };

          sortedStops.forEach((stop, index) => {
            const arrSec = toSeconds(stop.scheduledArrival);
            const depSec = toSeconds(stop.scheduledDeparture);

            if (index === 0) {
              if (depSec !== null) {
                scheduledStart = new Date(tripYear, tripMonth - 1, tripDay, Math.floor(depSec / 3600), Math.floor((depSec % 3600) / 60), depSec % 60);
                lastSeconds = depSec;
              }
            } else {
              if (arrSec !== null) {
                if (arrSec < lastSeconds) {
                  currentDayOffset += 1;
                }
                lastSeconds = arrSec;
                if (index === sortedStops.length - 1) {
                  scheduledEnd = new Date(tripYear, tripMonth - 1, tripDay + currentDayOffset, Math.floor(arrSec / 3600), Math.floor((arrSec % 3600) / 60), arrSec % 60);
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

    const showStartPromptBanner = departurePassed && showStartPrompt && 
      (trip.status?.toLowerCase() === 'scheduled' || trip.status?.toLowerCase() === 'delayed');
    
    if (showStartPromptBanner) {
      setShowArrivedPopup(false);
      return;
    }

    const showEndPromptBanner = arrivalPassed && showEndPrompt && 
      (trip.status?.toLowerCase() === 'intransit' || trip.status?.toLowerCase() === 'departed');

    if (showEndPromptBanner) {
      setShowArrivedPopup(false);
      return;
    }

    const statusLower = trip.status?.toLowerCase();
    if (statusLower !== 'intransit' && statusLower !== 'delayed' && statusLower !== 'departed' && statusLower !== 'active') {
      setShowArrivedPopup(false);
      return;
    }

    if (promptStopId) {
      setShowArrivedPopup(true);
      setPromptStatusTag('AtStation');
    } else {
      setShowArrivedPopup(false);
      const isDismissed = sessionStorage.getItem(`prompt_dismissed_${trip.id}`) === 'true';
      if (!isDismissed) {
        // Scheduled progress check: compare last reported stop in the feed vs scheduled predicted stop
        const getEgyptTime = () => {
          const options = { timeZone: 'Africa/Cairo', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' };
          const timeString = new Date().toLocaleTimeString('en-US', options);
          return timeString;
        };

        const getEgyptDateStr = () => {
          const options = { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' };
          const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(new Date());
          const year = parts.find(p => p.type === 'year').value;
          const month = parts.find(p => p.type === 'month').value;
          const day = parts.find(p => p.type === 'day').value;
          return `${year}-${month}-${day}`;
        };

        const parseTimeToMinutes = (timeStr) => {
          if (!timeStr) return 0;
          const parts = timeStr.split(':');
          const h = parseInt(parts[0], 10) || 0;
          const m = parseInt(parts[1], 10) || 0;
          return h * 60 + m;
        };

        const egyptTime = getEgyptTime();
        const egyptDate = getEgyptDateStr();
        const stops = [...(trip.routeStops || [])].sort((a, b) => a.stopOrder - b.stopOrder);
        if (stops.length === 0) return;

        const firstStop = stops[0];
        const tripStartTime = parseTimeToMinutes(firstStop.scheduledDeparture || firstStop.scheduledArrival || "00:00:00");

        let currentMinutes = parseTimeToMinutes(egyptTime);
        const isNextDay = egyptDate !== trip.tripDate;
        if (isNextDay) {
          currentMinutes += 24 * 60;
        }
        
        const elapsedMinutes = currentMinutes - tripStartTime;

        // Find predicted stop: the latest stop whose offset is <= elapsedMinutes
        let predictedStop = null;
        for (let i = stops.length - 1; i >= 0; i--) {
          const stop = stops[i];
          const stopTime = parseTimeToMinutes(stop.scheduledArrival || stop.scheduledDeparture || "00:00:00");
          let stopOffset = stopTime - tripStartTime;
          if (stopTime < tripStartTime) {
            stopOffset += 24 * 60;
          }

          if (elapsedMinutes >= stopOffset) {
            predictedStop = stop;
            break;
          }
        }

        // Find the last reported stop from feed posts matching "[Stop Name]" or starting with "Stop [Stop Name]"
        let lastMarkedStop = null;
        if (trip.recentUpdates && trip.recentUpdates.length > 0) {
          for (const update of trip.recentUpdates) {
            const contentText = update.content || '';
            let stopName = '';
            const matchBrackets = contentText.match(/^\[([^\]]+)\]/);
            if (matchBrackets) {
              stopName = matchBrackets[1].trim();
            } else {
              const matchStop = contentText.match(/^Stop\s+(.+?)(?:\s+-|$)/i);
              if (matchStop) {
                stopName = matchStop[1].trim();
              }
            }

            if (stopName) {
              const foundStop = trip.routeStops?.find(
                s => s.stopNameEn.toLowerCase() === stopName.toLowerCase() || 
                     s.stopNameAr.toLowerCase() === stopName.toLowerCase()
              );
              if (foundStop) {
                lastMarkedStop = foundStop;
                break;
              }
            }
          }
        }

        // Source 1: Live GPS Telemetry
        let telemetryStopOrder = 0;
        if (trip.status?.toLowerCase() !== 'arrived' && liveTelemetry) {
          const upcomingStopsList = liveTelemetry.upcomingStops || liveTelemetry.UpcomingStops;
          if (upcomingStopsList && upcomingStopsList.length > 0) {
            const nextStop = upcomingStopsList[0];
            const nextStopId = nextStop.stopId || nextStop.StopId;
            if (nextStopId) {
              const firstUpcoming = trip.routeStops?.find(rs => {
                const rsId = rs.stopId || rs.id || rs.StopId;
                return rsId?.toString().toLowerCase() === nextStopId.toString().toLowerCase();
              });
              if (firstUpcoming) {
                const distRemaining = nextStop.distanceRemaining ?? nextStop.DistanceRemaining ?? 999999;
                telemetryStopOrder = distRemaining < 800
                  ? firstUpcoming.stopOrder
                  : Math.max(1, firstUpcoming.stopOrder - 1);
              }
            }
          }
        }

        // Compare predicted stop with last reported/confirmed/telemetry stop
        if (predictedStop) {
          const lastMarkedOrder = Math.max(
            lastMarkedStop ? lastMarkedStop.stopOrder : 0,
            confirmedStopOrder,
            telemetryStopOrder
          );
          if (predictedStop.stopOrder > lastMarkedOrder) {
            // Reports are lagging behind the schedule! Show prompt for predicted stop.
            navigate(`?promptStopId=${predictedStop.stopId || predictedStop.id}`, { replace: true });
          }
        }
      }
    }
  }, [trip, promptStopId, showStartPrompt, showEndPrompt, liveTelemetry, confirmedStopOrder]);

  const handlePromptSubmit = async (e) => {
    if (e) e.preventDefault();
    if (submittingPrompt) return;

    setSubmittingPrompt(true);
    const promptStop = trip.routeStops?.find(s => 
      (s.stopId && s.stopId.toString().toLowerCase() === promptStopId?.toString().toLowerCase()) || 
      (s.id && s.id.toString().toLowerCase() === promptStopId?.toString().toLowerCase())
    );
    const stopName = promptStop ? (isRTL ? promptStop.stopNameAr : promptStop.stopNameEn) : 'Stop';

    const comment = promptContent.trim();
    const statusText = promptStatusTag ? ` - ${t(promptStatusTag)}` : '';
    const contentVal = comment ? `[${stopName}] ${comment}` : `Stop ${stopName}${statusText}`;

    const submitData = async (latitude = null, longitude = null) => {
      try {
        const res = await api.postTripLiveUpdate(
          trip.id,
          contentVal,
          promptStatusTag || null,
          promptCrowdState || null,
          latitude,
          longitude
        );

        if (res.isSuccess || res.statusCode === 201) {
          toast(t('Update posted successfully!') || 'Update posted successfully!');
          if (res.data) {
            // Immediately update local state so the stops sequence reflects the confirmed stop
            setTrip(prev => {
              if (!prev) return null;
              return {
                ...prev,
                recentUpdates: [res.data, ...(prev.recentUpdates || [])]
              };
            });
            // Pin the confirmed stop order so re-fetch flicker doesn't reset it
            const promptStop = trip.routeStops?.find(s =>
              (s.stopId && s.stopId.toString().toLowerCase() === promptStopId?.toString().toLowerCase()) ||
              (s.id && s.id.toString().toLowerCase() === promptStopId?.toString().toLowerCase())
            );
            if (promptStop) {
              setConfirmedStopOrder(promptStop.stopOrder);
              // Auto-scroll the stops sequence timeline to the confirmed stop
              setTimeout(() => {
                if (timelineRef.current) {
                  const currentEl = timelineRef.current.querySelector('.timeline-item.current');
                  if (currentEl) {
                    currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }
              }, 100);
            }
          }
          setPromptContent('');
          setPromptStatusTag('');
          setPromptCrowdState('');
          setPromptShareLocation(false);
          setShowArrivedPopup(false);
          sessionStorage.setItem(`prompt_dismissed_${trip.id}`, 'true');
          navigate(location.pathname, { replace: true });
          fetchTripDetails();
        } else {
          alert(res.message || 'Failed to post update.');
        }
      } catch (err) {
        console.error(err);
        alert(t('Failed to post update.') || 'Failed to post update.');
      } finally {
        setSubmittingPrompt(false);
      }
    };

    if (promptShareLocation) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            submitData(pos.coords.latitude, pos.coords.longitude);
          },
          (err) => {
            console.error('Geolocation error:', err);
            toast(t('Could not obtain your location. Posting without GPS.') || 'Could not obtain location. Posting without GPS.');
            submitData();
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      } else {
        toast(t('Geolocation not supported by browser. Posting without GPS.') || 'Geolocation not supported. Posting without GPS.');
        submitData();
      }
    } else {
      submitData();
    }
  };

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

  const openLeaderboardModal = async () => {
    try {
      setLoadingLeaderboard(true);
      setShowLeaderboardModal(true);
      setLeaderboardParticipants([]);
      const res = await api.getTripLeaderboard(id);
      if (res.isSuccess && res.data) {
        setLeaderboardParticipants(res.data);
      }
    } catch (err) {
      console.error("Failed to load trip leaderboard:", err);
      toast(isRTL ? "فشل تحميل لوحة الصدارة" : "Failed to load leaderboard", "error");
    } finally {
      setLoadingLeaderboard(false);
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
    sessionStorage.removeItem(`prompt_dismissed_${id}`);
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
      fetchTripDetails();
      setTrip((prevTrip) => {
        if (!prevTrip) return null;
        const updateId = update.id || update.Id;
        // Dedup by ID — prevents double-render when our own POST is echoed back by SignalR
        if (prevTrip.recentUpdates?.some(u => (u.id || u.Id) === updateId)) return prevTrip;

        let updatedStatus = prevTrip.status;
        let shouldRefresh = false;
        let matched = null;
        if (!update.authorId && update.statusTag) {
          const validStatuses = ['Scheduled', 'Departed', 'InTransit', 'Arrived', 'Cancelled', 'Delayed'];
          matched = validStatuses.find(s => s.toLowerCase() === update.statusTag.toLowerCase());
          if (matched) {
            updatedStatus = matched;
            shouldRefresh = true;
          }
        }

        if (shouldRefresh && (matched === 'Departed' || matched === 'Arrived')) {
          setTimeout(() => {
            fetchTripDetails();
          }, 500);
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

  // 1. Map Initialization
  useEffect(() => {
    if (!gpsTrackingEnabled || !mapRef.current || !trip) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      trainMarkerRef.current = null;
      stopMarkersRef.current = [];
      polylineRef.current = null;
      setHasSetInitialBounds(false);
      setMapReady(false);
      return;
    }

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true
      }).setView([26.8206, 30.8025], 6);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 20
      }).addTo(mapInstanceRef.current);

      mapInstanceRef.current.on('movestart', (e) => {
        if (e.originalEvent) {
          setIsAutoCentering(false);
        }
      });

      setMapReady(true);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      trainMarkerRef.current = null;
      stopMarkersRef.current = [];
      polylineRef.current = null;
      setHasSetInitialBounds(false);
      setMapReady(false);
    };
  }, [id, gpsTrackingEnabled, trip]);

  // 2. Static Route Polyline and Stops
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !trip) return;

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
    } else if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (trip.routeStops && stopMarkersRef.current.length === 0) {
      const stopIcon = L.divIcon({
        className: 'custom-stop-marker',
        html: `<div class="stop-dot"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });

      trip.routeStops.forEach(stop => {
        const marker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: 'Space Grotesk', sans-serif; padding: 4px;">
              <h4 style="margin: 0; color: var(--text-primary); font-size: 0.95rem;">${isRTL ? stop.stopNameAr : stop.stopNameEn}</h4>
              <p style="margin: 4px 0 0 0; color: var(--text-secondary); font-size: 0.8rem;">${isRTL ? stop.stopNameEn : stop.stopNameAr} (${stop.stopCode})</p>
            </div>
          `);
        stopMarkersRef.current.push(marker);
      });
    }

    if (!hasSetInitialBounds) {
      if (polylineRef.current) {
        map.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40] });
        setHasSetInitialBounds(true);
      } else if (trip.routeStops && trip.routeStops.length > 0) {
        const coords = trip.routeStops.map(s => [s.latitude, s.longitude]);
        map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
        setHasSetInitialBounds(true);
      }
    }
  }, [trip?.routePath, trip?.routeStops, mapReady, hasSetInitialBounds, isRTL]);

  // 3. Live Train Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !trip) return;

    if (liveTelemetry && liveTelemetry.snappedLatitude && liveTelemetry.snappedLongitude) {
      const pos = [liveTelemetry.snappedLatitude, liveTelemetry.snappedLongitude];
      
      if (!trainMarkerRef.current) {
        const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8080';
        const markerUrl = trip.markerPngUrl ? `${BASE_URL}${trip.markerPngUrl}` : '/train-marker.png';
        const trainIcon = L.divIcon({
          className: 'custom-train-marker-pin',
          html: `<div class="train-pulse-pin"></div><img src="${markerUrl}" style="width: 56px; height: 56px; display: block; object-fit: contain;" alt="Train Pin" />`,
          iconSize: [56, 56],
          iconAnchor: [28, 56],
          popupAnchor: [0, -56]
        });

        trainMarkerRef.current = L.marker(pos, { icon: trainIcon }).addTo(map);
      }

      trainMarkerRef.current.setLatLng(pos);
      trainMarkerRef.current.setPopupContent(`
        <div style="font-family: 'Space Grotesk', sans-serif; padding: 4px; text-align: center;">
          <h4 style="margin: 0; color: var(--text-primary); font-size: 0.95rem;">Train ${trip.trainNumber}</h4>
          <p style="margin: 4px 0 0 0; color: var(--text-secondary); font-size: 0.8rem;">Speed: ${(liveTelemetry.speed || 0).toFixed(1)} km/h</p>
        </div>
      `);
    }
  }, [liveTelemetry?.snappedLatitude, liveTelemetry?.snappedLongitude, liveTelemetry?.speed, trip?.trainNumber, trip?.markerPngUrl, mapReady]);

  // Handle auto-centering viewport separately to prevent non-location updates from triggering recenter
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (isAutoCentering && liveTelemetry && liveTelemetry.snappedLatitude && liveTelemetry.snappedLongitude) {
      const pos = [liveTelemetry.snappedLatitude, liveTelemetry.snappedLongitude];
      map.setView(pos, 15);
    }
  }, [liveTelemetry?.snappedLatitude, liveTelemetry?.snappedLongitude, isAutoCentering, mapReady]);

  // Map cleanup is now handled in the main initialization effect above

  // Passenger GPS Telemetry Broadcast Interval
  useEffect(() => {
    let watchId = null;
    let intervalId = null;

    if (passengerMode && gpsTrackingEnabled) {
      if (navigator.geolocation) {
        let lastCoords = null;
        let lastSentCoords = null;

        const haversineDistance = (coords1, coords2) => {
          const toRad = x => (x * Math.PI) / 180;
          const R = 6371e3; // Earth radius in meters
          const dLat = toRad(coords2.latitude - coords1.latitude);
          const dLon = toRad(coords2.longitude - coords1.longitude);
          const lat1 = toRad(coords1.latitude);
          const lat2 = toRad(coords2.latitude);

          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        };
        
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
            if (lastSentCoords) {
              const dist = haversineDistance(lastCoords, lastSentCoords);
              if (dist < 50) return; // Skip if haven't moved > 50 meters
            }

            try {
              const res = await api.submitTelemetry(
                id, 
                lastCoords.latitude, 
                lastCoords.longitude, 
                lastCoords.speed
              );
              
              if (res.isSuccess && res.data) {
                setLiveTelemetry(res.data);
                lastSentCoords = { ...lastCoords };
              }
            } catch (err) {
              console.error('Failed to submit passenger telemetry:', err);
            }
          }
        }, 20000); // 20 seconds
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

  const refreshTopContributorsAsync = async () => {
    try {
      const res = await api.getTripLeaderboard(id);
      if (res.isSuccess && res.data) {
        setTrip(prev => prev ? { ...prev, topContributors: res.data.slice(0, 3) } : null);
        setLeaderboardParticipants(res.data);
      }
    } catch(err) {
      console.error('Failed to refresh leaderboard:', err);
    }
  };

  const handleToggleThanks = async (updateId) => {
    if (isInactive) return;
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
        refreshTopContributorsAsync();
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
            recentUpdates: prev.recentUpdates.map(u => 
              u.id === updateId ? { ...u, isRemovalRequested: true } : u
            )
          };
        });
        toast(t('removalRequestSubmitted'), 'success');
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

        // Do NOT insert optimistically here — SignalR will broadcast the saved update
        // back to all clients (including the poster) and the listener above will add it.
        // Inserting here AND letting SignalR add it causes the duplicate-until-refresh bug.
        // The dedup guard in the SignalR listener (keyed on update.id) prevents any echo duplication.
        void savedUpdate; // reference kept for future use (e.g. navigating to the update)

        setContent('');
        setStatusTag('');
        setCrowdState('');
        setShareLocation(false);
        if (savedUpdate.isApproved) {
          toast(isRTL ? 'تم نشر التحديث بنجاح' : 'Update posted successfully', 'success');
        } else {
          toast(isRTL ? 'تم إرسال منشورك إلى الإدارة للمراجعة قبل النشر' : 'Your post sent to the administration to review before publishing', 'success');
        }
        fetchTripDetails();
      } catch (err) {
        toast((isRTL ? 'فشل في إرسال التحديث: ' : 'Failed to submit update: ') + err.message, 'error');
      } finally {
        setSubmittingUpdate(false);
      }
    };

    if (shareLocation && gpsTrackingEnabled) {
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

  // --- STOP ORDER COMPUTATION ---
  // Each source independently computes a candidate stop order.
  // The final value is the MAXIMUM of all sources (trains only move forward).
  // This ensures passenger manual reports override stale telemetry, and
  // vice-versa when GPS is ahead of the last passenger report.

  let telemetryStopOrder = 0;
  let recentUpdatesStopOrder = 0;
  let timeBasedStopOrder = 0;

  // Source 1: Live GPS Telemetry
  if (trip.status?.toLowerCase() !== 'arrived' && liveTelemetry) {
    const upcomingStopsList = liveTelemetry.upcomingStops || liveTelemetry.UpcomingStops;
    if (upcomingStopsList && upcomingStopsList.length > 0) {
      const nextStop = upcomingStopsList[0];
      const nextStopId = nextStop.stopId || nextStop.StopId;
      if (nextStopId) {
        const firstUpcoming = trip.routeStops?.find(rs => {
          const rsId = rs.stopId || rs.id || rs.StopId;
          return rsId?.toString().toLowerCase() === nextStopId.toString().toLowerCase();
        });
        if (firstUpcoming) {
          const distRemaining = nextStop.distanceRemaining ?? nextStop.DistanceRemaining ?? 999999;
          telemetryStopOrder = distRemaining < 800
            ? firstUpcoming.stopOrder          // arriving at this stop
            : Math.max(1, firstUpcoming.stopOrder - 1); // between last and this stop
        }
      }
    }
  }

  // Source 2: Passenger Reports from recentUpdates (highest reported stop)
  if (trip.recentUpdates && trip.recentUpdates.length > 0) {
    for (const update of trip.recentUpdates) {
      const contentText = update.content || '';
      let stopName = '';
      const matchBrackets = contentText.match(/^\[([^\]]+)\]/);
      if (matchBrackets) {
        stopName = matchBrackets[1].trim();
      } else {
        const matchStop = contentText.match(/^Stop\s+(.+?)(?:\s+-|$)/i);
        if (matchStop) {
          stopName = matchStop[1].trim();
        }
      }
      if (stopName) {
        const matchedStop = trip.routeStops?.find(rs =>
          rs.stopNameEn.toLowerCase() === stopName.toLowerCase() ||
          rs.stopNameAr.toLowerCase() === stopName.toLowerCase()
        );
        if (matchedStop && matchedStop.stopOrder > recentUpdatesStopOrder) {
          recentUpdatesStopOrder = matchedStop.stopOrder;
        }
      }
    }
  }

  // Source 3: Time-based prediction (schedule fallback)
  const statusLow = trip.status?.toLowerCase();
  if (statusLow === 'arrived') {
    timeBasedStopOrder = totalStops + 1;
  } else if (statusLow === 'departed' || statusLow === 'intransit' || statusLow === 'active') {
    const stops = [...(trip.routeStops || [])].sort((a, b) => a.stopOrder - b.stopOrder);
    if (stops.length > 0) {
      const firstStop = stops[0];
      const tripStartTime = parseTimeToMinutes(firstStop.scheduledDeparture || firstStop.scheduledArrival || '00:00:00');
      let currentMinutes = parseTimeToMinutes(getEgyptTime());
      if (getEgyptDateStr() !== trip.tripDate) currentMinutes += 24 * 60;
      const elapsedMinutes = currentMinutes - tripStartTime;
      for (let i = stops.length - 1; i >= 0; i--) {
        const stop = stops[i];
        const stopTime = parseTimeToMinutes(stop.scheduledArrival || stop.scheduledDeparture || '00:00:00');
        let stopOffset = stopTime - tripStartTime;
        if (stopTime < tripStartTime) stopOffset += 24 * 60;
        if (elapsedMinutes >= stopOffset) {
          timeBasedStopOrder = stop.stopOrder;
          break;
        }
      }
      if (timeBasedStopOrder === 0) timeBasedStopOrder = 1;
    }
  } else if (totalStops > 0) {
    timeBasedStopOrder = 1; // Scheduled / Pending: first stop
  }

  // Merge: take the maximum of all sources (train only moves forward),
  // but also respect any manually confirmed stop from state (survives re-fetch flicker).
  // Note: timeBasedStopOrder is excluded from currentStopOrder so that the timeline stops
  // are not automatically marked as passed/completed without user/telemetry confirmation.
  let currentStopOrder = Math.max(
    telemetryStopOrder,
    recentUpdatesStopOrder,
    confirmedStopOrder
  );
  if (currentStopOrder === 0) {
    currentStopOrder = 1;
  }

  // Terminal: if arrived, always show past-end
  if (statusLow === 'arrived') {
    currentStopOrder = totalStops + 1;
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
        setTrip(prev => prev ? { 
          ...prev, 
          status: res.data.status,
          statusDetails: res.data.statusDetails
        } : null);
        setShowStartPrompt(false);
        setPassengerMode(true);
        fetchTripDetails();
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
        setTrip(prev => prev ? { 
          ...prev, 
          status: res.data.status,
          statusDetails: res.data.statusDetails
        } : null);
        setShowEndPrompt(false);
        setPassengerMode(false);
        fetchTripDetails();
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
    const sortedStops = [...trip.routeStops].sort((a, b) => a.stopOrder - b.stopOrder);
    const firstStop = sortedStops[0];
    const lastStop = sortedStops[sortedStops.length - 1];

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

        sortedStops.forEach((stop, index) => {
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
              if (index === sortedStops.length - 1) {
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

  const leftCardsHeight = rightColumnHeight > 560 ? rightColumnHeight : 560;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <AdInterstitial pageKey="tripDetails" instanceId={id} trainNumber={trip.trainNumber} />
      {/* Header Info Banner */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', borderRadius: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '0', alignSelf: 'stretch', flexWrap: 'wrap' }}>
          {trip.imageUrl ? (
            <img 
              src={`http://localhost:5245${trip.imageUrl}`} 
              alt="Train Type"
              style={{
                width: '222px',
                height: '130px',
                objectFit: 'cover',
                borderRight: isRTL ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                borderLeft: isRTL ? '1px solid rgba(255, 255, 255, 0.08)' : 'none'
              }}
            />
          ) : null}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '24px', 
            padding: isRTL 
              ? `32px 32px 32px ${trip.imageUrl ? '32px' : '32px'}` 
              : `32px 32px 32px ${trip.imageUrl ? '32px' : '32px'}` 
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '16px',
              background: 'var(--accent-gradient)',
              color: 'var(--accent-contrast)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 800,
              fontFamily: 'Space Grotesk',
              flexShrink: 0
            }}>
              {trip.trainNumber}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {isRTL ? trip.trainNameAr : trip.trainNameEn}
                </h1>
                <span 
                  className="badge" 
                  style={{
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
        </div>

        {!isInactive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '32px' }}>
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
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 15%, transparent) 0%, rgba(244, 63, 94, 0.05) 100%)',
          border: '1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px 0 color-mix(in srgb, var(--accent-primary) 10%, transparent)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '280px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'color-mix(in srgb, var(--accent-primary) 25%, transparent)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px color-mix(in srgb, var(--accent-primary) 40%, transparent)'
            }}>
              <Clock size={24} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif' }}>
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
                boxShadow: '0 4px 12px color-mix(in srgb, var(--accent-primary) 30%, transparent)',
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
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif' }}>
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
      <div 
        className={`dashboard-grid trip-details-grid ${!gpsTrackingEnabled ? 'gps-disabled' : ''}`}
        style={!gpsTrackingEnabled ? { gridTemplateColumns: '1fr 1fr' } : {}}
      >
        {/* Left Side: Map & Timeline side-by-side */}
        <div style={{ display: 'flex', gap: '24px', flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', alignItems: 'stretch', flex: '2 1 0px', minWidth: '0px' }}>
          {/* Map Card */}
          {gpsTrackingEnabled && (
            <div className="glass-panel" style={{ padding: '24px', flex: '1 1 45%', display: 'flex', flexDirection: 'column', height: `${leftCardsHeight}px`, minWidth: '320px' }}>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <Navigation size={20} color="var(--accent-primary)" /> {t('liveRouteTracking')}
              </h3>
              
              {/* Map Container Wrapper */}
              <div style={{ position: 'relative', flexGrow: 1, minHeight: '220px', marginBottom: '16px' }}>
                <div ref={mapRef} className="map-container" style={{ height: '100%', marginBottom: 0 }}></div>

                {/* Floating Re-center Button */}
                {liveTelemetry && liveTelemetry.snappedLatitude > 0 && (
                  <button 
                    onClick={handleRecenter}
                    className="btn"
                    style={{
                      position: 'absolute',
                      bottom: '12px',
                      left: '12px',
                      zIndex: 1000,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(12px)',
                      background: 'var(--accent-gradient)',
                      color: 'var(--accent-contrast)',
                      cursor: 'pointer',
                      opacity: 1,
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <Navigation size={12} style={{ transform: 'rotate(45deg)', fill: 'currentColor' }} />
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
                  padding: '10px 14px',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                  gap: '8px',
                  flexShrink: 0
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: 'var(--success)',
                      display: 'inline-block',
                      boxShadow: '0 0 6px var(--success)',
                      animation: 'pulseGlow 1.5s infinite'
                    }}></span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {t('liveGpsSnappingActive') || 'Live Snapped Tracking Active'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {t('speedometer') || 'Speed'}: <strong style={{ color: 'var(--accent-secondary)' }}>{(liveTelemetry.speed || 0).toFixed(0)} km/h</strong>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
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
                  background: 'color-mix(in srgb, var(--accent-primary) 4%, transparent)',
                  border: '1px dashed color-mix(in srgb, var(--accent-primary) 25%, transparent)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  flexShrink: 0
                }}>
                  <div style={{ paddingEnd: '8px' }}>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      {t('passengerModeTitle') || 'Passenger Mode (Share GPS)'}
                    </h4>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px', margin: 0, lineHeight: 1.2 }}>
                      {t('passengerModeSub') || 'Broadcast your location to improve live ETA snapping for all users.'}
                    </p>
                  </div>
                  <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '36px', height: '18px', flexShrink: 0 }}>
                    <input 
                      type="checkbox" 
                      checked={passengerMode}
                      onChange={(e) => setPassengerMode(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: passengerMode ? 'var(--accent-primary)' : 'var(--border-color)',
                      transition: '0.4s',
                      borderRadius: '18px'
                    }}>
                      <span style={{
                        position: 'absolute',
                        content: '""',
                        height: '12px', width: '12px',
                        left: passengerMode ? '21px' : '3px',
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
          )}

          {/* Stops Timeline Sequence */}
          <div className="glass-panel" style={{ padding: '24px', flex: '1 1 45%', display: 'flex', flexDirection: 'column', height: `${leftCardsHeight}px`, minWidth: '320px' }}>
            <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <MapPin size={18} color="var(--accent-secondary)" /> {t('stopsSequence') || 'Stops Sequence'}
            </h4>
            <div ref={timelineRef} style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '8px', position: 'relative', minHeight: 0 }}>
              <div className="trip-timeline" style={{ marginTop: 0 }}>
                {trip.routeStops?.map((stop, index) => {
                  const isPassed = stop.stopOrder < currentStopOrder;
                  const isCurrent = stop.stopOrder === currentStopOrder;
                  
                  return (
                    <div key={`${stop.stopId}-${stop.stopOrder || index}`} className={`timeline-item ${isPassed ? 'passed' : ''} ${isCurrent ? 'current' : ''}`}>
                      <div className="timeline-node"></div>
                      <div className="timeline-content">
                        <div className="station-details">
                          <div className="station-name">{isRTL ? stop.stopNameAr : stop.stopNameEn}</div>
                          <div className="station-info">{isRTL ? stop.stopNameEn : stop.stopNameAr} ({stop.stopCode})</div>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingInlineEnd: '22px' }}>
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

        {/* Right Side: Leadership & Updates */}
        <div ref={rightColumnRef} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Trip Top Contributors leaderboard box */}
          {trip.topContributors && trip.topContributors.length > 0 && (
            <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div 
                onClick={openLeaderboardModal}
                style={{ 
                  background: 'rgba(251, 191, 36, 0.12)', 
                  padding: '8px', 
                  borderRadius: '8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  flexShrink: 0,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: '1px solid rgba(251, 191, 36, 0.25)'
                }}
                className="hover-scale"
                title={isRTL ? 'عرض المزيد' : 'Show More'}
              >
                <Trophy size={18} color="#f59e0b" />
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flexGrow: 1, alignItems: 'center' }}>
                {trip.topContributors.map((entry, idx) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={entry.userId} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(120,120,120,0.02)', borderRadius: '10px', padding: '8px 12px', border: '1px solid var(--border-color)', flex: '1 1 auto', justifyContent: 'center' }}>
                      <span style={{ fontSize: '1.25rem' }}>{medals[idx] || `#${entry.rank}`}</span>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--accent-contrast)', fontSize: '0.85rem', flexShrink: 0 }}>
                        {entry.displayName?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.2' }}>{entry.displayName}</span>
                        <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 800, lineHeight: '1.2' }}>{entry.totalPoints} {t('points')}</span>
                      </div>
                    </div>
                  );
                })}

                {/* Show More Icon Button */}
                <button
                  onClick={openLeaderboardModal}
                  style={{
                    background: 'rgba(120, 120, 120, 0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    marginLeft: isRTL ? '0' : 'auto',
                    marginRight: isRTL ? 'auto' : '0'
                  }}
                  title={isRTL ? 'عرض المزيد' : 'Show More'}
                  type="button"
                >
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </div>
          )}
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
                    {gpsTrackingEnabled && (
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
                    )}

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
                          <div className="feed-avatar" style={{ background: 'var(--accent-primary)', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--accent-contrast)', fontSize: '0.75rem' }}>
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
                              disabled={isInactive}
                              style={isInactive ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
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
                        {gpsTrackingEnabled && update.latitude && update.longitude && (
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
      {/* Interactive Arrived Verification Popup Modal */}
      {showArrivedPopup && trip && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100,
          padding: '20px',
          textAlign: isRTL ? 'right' : 'left'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '500px',
            padding: '28px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(30, 30, 46, 0.93), rgba(18, 18, 28, 0.97))',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px color-mix(in srgb, var(--accent-primary) 25%, transparent)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            border: 'none',
            direction: isRTL ? 'rtl' : 'ltr'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                background: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)',
                color: 'var(--accent-primary)',
                padding: '10px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ffffff', margin: 0, lineHeight: '1.4' }}>
                {isRTL ? 'تحقق من تقدم الرحلة' : 'Check Trip Progress'}
              </h3>
            </div>

            <p style={{ fontSize: '0.95rem', color: '#cbd5e1', margin: 0, lineHeight: '1.5' }}>
              {t('isTripTrainArrivedHeader') || 'Is the trip of the train number'} <strong style={{ color: 'var(--accent-primary)' }}>{trip.trainNumber}</strong> {t('arrivedToStopLabel') || 'arrived to stop'} <strong style={{ color: 'var(--accent-primary)' }}>{
                (() => {
                  const promptStop = trip.routeStops?.find(s => 
                    (s.stopId && s.stopId.toString().toLowerCase() === promptStopId?.toString().toLowerCase()) || 
                    (s.id && s.id.toString().toLowerCase() === promptStopId?.toString().toLowerCase())
                  );
                  return promptStop ? (isRTL ? promptStop.stopNameAr : promptStop.stopNameEn) : '';
                })()
              }</strong>?
            </p>

            <form onSubmit={handlePromptSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t('feedback') || 'Feedback / Comment'} <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 'normal' }}>({isRTL ? 'اختياري' : 'Optional'})</span>
                </label>
                <textarea
                  placeholder={t('writeYourFeedback') || 'Enter your feedback here...'}
                  value={promptContent}
                  onChange={(e) => setPromptContent(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    minHeight: '80px',
                    resize: 'none',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--accent-primary)';
                    e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent-primary) 15%, transparent)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {t('tripStatus') || 'Trip Status'}
                  </label>
                  <select
                    value={promptStatusTag}
                    onChange={(e) => setPromptStatusTag(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '10px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="" style={{ background: '#1e1e2e' }}>-- {t('selectStatus') || 'Select Status'} --</option>
                    {statusTagsList.map(tag => (
                      <option key={tag.id} value={tag.code} style={{ background: '#1e1e2e' }}>{isRTL ? tag.nameAr : tag.nameEn}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {t('trainCrowd') || 'Train Crowd'}
                  </label>
                  <select
                    value={promptCrowdState}
                    onChange={(e) => setPromptCrowdState(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '10px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="" style={{ background: '#1e1e2e' }}>-- {t('selectCrowd') || 'Select Crowd'} --</option>
                    {crowdLevelsList.map(lvl => (
                      <option key={lvl.id} value={lvl.code} style={{ background: '#1e1e2e' }}>{isRTL ? lvl.nameAr : lvl.nameEn}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                <input
                  type="checkbox"
                  id="promptGps"
                  checked={promptShareLocation}
                  onChange={(e) => setPromptShareLocation(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                />
                <label htmlFor="promptGps" style={{ fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer', userSelect: 'none' }}>
                  {t('attachGps') || 'Attach my GPS Location'}
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowArrivedPopup(false);
                    sessionStorage.setItem(`prompt_dismissed_${trip.id}`, 'true');
                    navigate(location.pathname, { replace: true });
                  }}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: 'transparent',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#f87171',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.08)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  {isRTL ? 'لا' : 'No'}
                </button>
                <button
                  type="submit"
                  disabled={submittingPrompt}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary))',
                    boxShadow: '0 4px 14px color-mix(in srgb, var(--accent-primary) 40%, transparent)',
                    border: 'none',
                    color: '#ffffff',
                    opacity: submittingPrompt ? 0.6 : 1,
                    transition: 'transform 0.1s, opacity 0.2s'
                  }}
                  onMouseDown={(e) => e.target.style.transform = 'scale(0.97)'}
                  onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
                >
                  {submittingPrompt ? (t('submitting') || 'Submitting...') : (isRTL ? 'نعم' : 'Yes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Trip Leaderboard Full Popup Modal */}
      {showLeaderboardModal && (
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
              onClick={() => setShowLeaderboardModal(false)}
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
                  {isRTL ? 'لوحة صدارة الرحلة' : 'Trip Leaderboard'}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  {isRTL ? 'جميع المشاركين ونقاطهم في هذه الرحلة' : 'All participants and their scores on this trip'}
                </p>
              </div>
            </div>

            {/* Scrollable list */}
            <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '150px', justifyContent: loadingLeaderboard ? 'center' : 'flex-start' }}>
              {loadingLeaderboard ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-secondary)' }}>
                  <div className="spinner" style={{ borderTopColor: 'var(--accent-primary)', width: '32px', height: '32px', margin: '0 auto 12px auto' }}></div>
                  <p style={{ fontSize: '0.85rem', margin: 0 }}>{isRTL ? 'جاري التحميل...' : 'Loading leaderboard...'}</p>
                </div>
              ) : leaderboardParticipants.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                  <Trophy size={32} style={{ marginBottom: '12px', opacity: 0.2 }} />
                  <p style={{ fontSize: '0.85rem', margin: 0 }}>{isRTL ? 'لا توجد مشاركات في هذه الرحلة بعد' : 'No participants on this trip yet'}</p>
                </div>
              ) : (
                <>
                  {leaderboardParticipants.map((entry, idx) => {
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

                  {/* Friendly encouragement message if the logged in user is NOT in the list */}
                  {user && !leaderboardParticipants.some(p => p.userId === user.id) && (
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
                          ? '😊 لم تسجل أي نقاط في هذه الرحلة بعد! تفاعل بمشاركة موقعك أو إرسال تحديثات لتكسب نقاطك وتنافس في لوحة الصدارة!'
                          : "😊 You haven't earned any points on this trip yet! Share your location or post a live update to join the fun and claim your spot on the leaderboard!"}
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
                onClick={() => setShowLeaderboardModal(false)}
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

export default TripDetails;
