import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { Clock } from 'lucide-react';
import signalrService from '../services/signalrService';

export const DashboardMapAndFeed = ({ statsData, api, isRTL }) => {
  const [activeTrips, setActiveTrips] = useState([]);
  const [telemetries, setTelemetries] = useState({});
  const [selectedTripId, setSelectedTripId] = useState("");
  const [recentUpdates, setRecentUpdates] = useState(statsData?.recentUpdates || []);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tripMarkersRef = useRef({});
  const pathPolylinesRef = useRef([]);
  const lastCenteredTripIdRef = useRef("");

  const filteredTrips = selectedTripId 
    ? activeTrips.filter(t => t && t.id && t.id.toString() === selectedTripId.toString())
    : activeTrips;

  // Load Trips
  useEffect(() => {
    const loadData = async () => {
      try {
        const tripsRes = await api.getTodayTrips();
        
        // Filter active trips (InTransit, Departed, Delayed, Scheduled)
        const allTrips = tripsRes.data || [];
        const active = allTrips.filter(t => 
          t && t.status && ['intransit', 'departed', 'delayed', 'scheduled'].includes(t.status.toLowerCase())
        );
        setActiveTrips(active);
        
        // Initialize telemetries for active trips using their initial coordinate
        const initialTelemetries = {};
        for (const trip of active) {
          if (!trip || !trip.id) continue;
          try {
            const tracking = await api.getTripTracking(trip.id);
            if (tracking && tracking.data && tracking.data.snappedLatitude > 0) {
              initialTelemetries[trip.id] = tracking.data;
            } else if (trip.routeStops && trip.routeStops.length > 0) {
              const firstStop = trip.routeStops.reduce((prev, curr) => prev.stopOrder < curr.stopOrder ? prev : curr);
              if (firstStop) {
                initialTelemetries[trip.id] = {
                  tripId: trip.id,
                  snappedLatitude: firstStop.latitude,
                  snappedLongitude: firstStop.longitude,
                  speed: 0
                };
              }
            }
          } catch (err) {
            console.error('Failed to load tracking for trip:', trip.id, err);
          }
        }
        setTelemetries(initialTelemetries);

        // Join SignalR group for each active trip to receive live coordinates
        active.forEach(trip => {
          if (trip && trip.id) {
            signalrService.joinTrip(trip.id).catch(err => console.error(err));
          }
        });
      } catch (err) {
        console.error('Error loading map data:', err);
      }
    };
    loadData();

    // SignalR Live update location listener
    const unsubscribeLocation = signalrService.registerLocationListener((locUpdate) => {
      if (locUpdate && locUpdate.tripId) {
        setTelemetries(prev => ({
          ...prev,
          [locUpdate.tripId]: locUpdate
        }));
      }
    });

    // SignalR Live update status & comments listener
    const unsubscribeUpdate = signalrService.registerListener((update) => {
      // Prepend to recent updates list
      setRecentUpdates(prev => {
        if (prev.some(u => u.id === update.id)) return prev;
        return [update, ...prev];
      });

      // Update activeTrips if status changes
      if (update.tripId && update.statusTag) {
        const statusLower = update.statusTag.toLowerCase();
        const inactiveStatuses = ['arrived', 'cancelled', 'completed', 'ended', 'canceled'];
        if (inactiveStatuses.includes(statusLower)) {
          setActiveTrips(prev => prev.filter(t => t.id !== update.tripId && t.id.toString() !== update.tripId.toString()));
        } else {
          setActiveTrips(prev => prev.map(t => {
            if (t.id.toString() === update.tripId.toString()) {
              const validStatuses = ['Scheduled', 'Departed', 'InTransit', 'Arrived', 'Cancelled', 'Delayed'];
              const matched = validStatuses.find(s => s.toLowerCase() === update.statusTag.toLowerCase());
              return {
                ...t,
                status: matched || t.status
              };
            }
            return t;
          }));
        }
      }
    });

    return () => {
      unsubscribeLocation();
      unsubscribeUpdate();
      // Join group is dynamic, leave all active trips that were loaded
      api.getTodayTrips().then(tripsRes => {
        const allTrips = tripsRes.data || [];
        allTrips.forEach(trip => {
          if (trip && trip.id) {
            signalrService.leaveTrip(trip.id).catch(err => console.error(err));
          }
        });
      }).catch(err => console.error(err));
    };
  }, []);

  // Map Instance Init
  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      const container = mapContainerRef.current;
      if (container._leaflet_id) {
        return; // Avoid double initialization error
      }

      mapInstanceRef.current = L.map(container, {
        zoomControl: true,
        scrollWheelZoom: true
      }).setView([26.8206, 30.8025], 6);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20
      }).addTo(mapInstanceRef.current);
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.error(e);
        }
        mapInstanceRef.current = null;
      }
      tripMarkersRef.current = {};
      pathPolylinesRef.current = [];
    };
  }, []);

  // Draw Polylines for Active Trips (Deduplicated)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old polylines
    pathPolylinesRef.current.forEach(p => p && p.remove());
    pathPolylinesRef.current = [];

    if (!filteredTrips || filteredTrips.length === 0) return;

    // Track coordinates of drawn paths to avoid duplication
    const drawnPaths = new Set();

    filteredTrips.forEach(trip => {
      if (!trip || !trip.routePath || trip.routePath.length === 0) return;

      // Create a unique key for the path coordinates to avoid duplicates
      const pathKey = JSON.stringify(trip.routePath);
      if (drawnPaths.has(pathKey)) {
        return; // Skip drawing to avoid duplication
      }
      drawnPaths.add(pathKey);

      // Sanitize coordinates
      const validCoords = trip.routePath.filter(c => 
        Array.isArray(c) && c.length >= 2 && !isNaN(c[0]) && !isNaN(c[1])
      );

      if (validCoords.length > 0) {
        const polyline = L.polyline(validCoords, {
          color: '#4f46e5',
          weight: 4,
          opacity: 0.65,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);
        pathPolylinesRef.current.push(polyline);
      }
    });

    if (pathPolylinesRef.current.length > 0) {
      try {
        const group = new L.FeatureGroup(pathPolylinesRef.current);
        const bounds = group.getBounds();
        if (bounds && bounds.isValid()) {
          map.fitBounds(bounds, { padding: [40, 40] });
        }
      } catch (e) {
        console.error('Failed to fit bounds:', e);
      }
    }
  }, [filteredTrips]);

  // Update Trip Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old markers for trips that are no longer in filtered list
    Object.keys(tripMarkersRef.current).forEach(tripId => {
      if (!filteredTrips.some(t => t && t.id && t.id.toString() === tripId)) {
        if (tripMarkersRef.current[tripId]) {
          tripMarkersRef.current[tripId].remove();
        }
        delete tripMarkersRef.current[tripId];
      }
    });

    // Plot/update active trip markers
    filteredTrips.forEach(trip => {
      if (!trip || !trip.id) return;
      const tele = telemetries[trip.id];
      if (tele && tele.snappedLatitude && tele.snappedLongitude) {
        const pos = [tele.snappedLatitude, tele.snappedLongitude];
        
        const markerUrl = trip.markerPngUrl ? `http://localhost:5245${trip.markerPngUrl}` : '/train-marker.png';
        const trainIcon = L.divIcon({
          className: 'custom-train-marker-pin',
          html: `<div class="train-pulse-pin" style="background: rgba(99, 102, 241, 0.45)"></div><img src="${markerUrl}" style="width: 44px; height: 44px; display: block; object-fit: contain;" alt="Train Pin" />`,
          iconSize: [44, 44],
          iconAnchor: [22, 44],
          popupAnchor: [0, -44]
        });

        const popupContent = `
          <div style="font-family: Outfit, sans-serif; padding: 6px; min-width: 150px;">
            <h4 style="margin: 0 0 4px 0; color: var(--text-primary); font-size: 0.95rem;">Train ${trip.trainNumber || ''}</h4>
            <p style="margin: 0 0 2px 0; color: var(--text-secondary); font-size: 0.8rem;"><b>Route:</b> ${isRTL ? (trip.trainNameAr || '') : (trip.trainNameEn || '')}</p>
            <p style="margin: 0 0 2px 0; color: var(--text-secondary); font-size: 0.8rem;"><b>Speed:</b> ${(tele.speed || 0).toFixed(1)} km/h</p>
            <p style="margin: 0; color: var(--text-secondary); font-size: 0.8rem;"><b>Status:</b> <span class="badge badge-info" style="font-size: 0.65rem; padding: 1px 6px;">${trip.status || ''}</span></p>
          </div>
        `;

        if (!tripMarkersRef.current[trip.id]) {
          const marker = L.marker(pos, { icon: trainIcon })
            .addTo(map)
            .bindPopup(popupContent);
          tripMarkersRef.current[trip.id] = marker;
        } else {
          const marker = tripMarkersRef.current[trip.id];
          marker.setLatLng(pos);
          marker.setIcon(trainIcon);
          marker.setPopupContent(popupContent);
        }
      }
    });
  }, [filteredTrips, telemetries, isRTL]);

  // Auto-focus map on selected trip
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedTripId) return;

    if (lastCenteredTripIdRef.current !== selectedTripId) {
      const tele = telemetries[selectedTripId];
      if (tele && tele.snappedLatitude && tele.snappedLongitude && tele.snappedLatitude !== 0) {
        map.setView([tele.snappedLatitude, tele.snappedLongitude], 12, { animate: true });
        lastCenteredTripIdRef.current = selectedTripId;
      }
    }
  }, [selectedTripId, telemetries]);

  useEffect(() => {
    if (!selectedTripId) {
      lastCenteredTripIdRef.current = "";
    }
  }, [selectedTripId]);

  return (
    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', width: '100%' }}>
      {/* 70% Map Container */}
      <div className="glass-panel" style={{ flex: '7 1 600px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            🗺️ {isRTL ? "خريطة الرحلات النشطة" : "Live Active Trips Map"}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select
              value={selectedTripId}
              onChange={(e) => setSelectedTripId(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'rgba(30, 30, 30, 0.4)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="" style={{ background: 'var(--bg-glass-card, #1e1e1e)', color: 'var(--text-primary)' }}>
                {isRTL ? "عرض كل الرحلات" : "Show All Trips"}
              </option>
              {activeTrips.map(trip => (
                <option key={trip.id} value={trip.id} style={{ background: 'var(--bg-glass-card, #1e1e1e)', color: 'var(--text-primary)' }}>
                  {isRTL 
                    ? `قطار ${trip.trainNumber} (${trip.trainNameAr || ''})` 
                    : `Train ${trip.trainNumber} (${trip.trainNameEn || ''})`}
                </option>
              ))}
            </select>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {filteredTrips.length} {isRTL ? "رحلة" : "Active Trips"}
            </span>
          </div>
        </div>
        <div ref={mapContainerRef} style={{ height: '520px', width: '100%' }} />
      </div>

      {/* 30% Feed Container */}
      <div className="glass-panel" style={{ flex: '3 1 300px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '585px', overflowY: 'auto' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={18} color="var(--accent-primary)" /> Passenger Live Activity Feed
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!recentUpdates || recentUpdates.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No recent updates from passengers today.</p>
          ) : (
            recentUpdates.filter(upd => upd && upd.id).map(upd => {
              const formattedTime = () => {
                if (!upd.createdAt) return '';
                const date = new Date(upd.createdAt);
                return isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              };
              return (
                <div key={upd.id} style={{ display: 'flex', gap: '12px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(120, 120, 120, 0.01)' }}>
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white', overflow: 'hidden' }}>
                      {upd.authorAvatarUrl ? (
                        <img src={api.resolveImageUrl(upd.authorAvatarUrl)} alt={upd.authorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        upd.authorName ? upd.authorName.charAt(0).toUpperCase() : 'U'
                      )}
                    </div>
                  </div>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{upd.authorName}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{formattedTime()}</div>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 6px 0', lineBreak: 'anywhere' }}>{upd.content}</p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {upd.statusTag && <span className="badge badge-info" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>{upd.statusTag}</span>}
                      {upd.crowdState && <span className="badge badge-secondary" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>{upd.crowdState}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
