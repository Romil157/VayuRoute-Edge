import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useOSRMRoutes } from '../hooks/useOSRMRoutes';

// ─── Haversine distance in km between two [lat, lng] points ─────────────────
function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(sin2));
}

// ─── Compute cumulative distances along a polyline ──────────────────────────
function cumulativeDistances(positions) {
  const dists = [0];
  for (let i = 1; i < positions.length; i++) {
    dists.push(dists[i - 1] + haversineKm(positions[i - 1], positions[i]));
  }
  return dists;
}

// ─── Interpolate a point at a given distance along the polyline ─────────────
function interpolateAlongPolyline(positions, cumDists, targetKm) {
  if (!positions.length) return null;
  if (targetKm <= 0) return { pos: positions[0], segIdx: 0 };
  const totalDist = cumDists[cumDists.length - 1];
  if (targetKm >= totalDist) return { pos: positions[positions.length - 1], segIdx: positions.length - 2 };

  // Binary search for the segment
  let lo = 0;
  let hi = cumDists.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumDists[mid] <= targetKm) lo = mid;
    else hi = mid;
  }

  const segLen = cumDists[hi] - cumDists[lo];
  const ratio = segLen > 0 ? (targetKm - cumDists[lo]) / segLen : 0;

  const a = positions[lo];
  const b = positions[hi];
  return {
    pos: [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio],
    segIdx: lo,
  };
}

// ─── Bearing computation ────────────────────────────────────────────────────
function computeBearing(from, to) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  const lat1 = toRad(from[0]);
  const lat2 = toRad(to[0]);
  const dLng = toRad(to[1] - from[1]);

  const x = Math.sin(dLng) * Math.cos(lat2);
  const y =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (toDeg(Math.atan2(x, y)) + 360) % 360;
}

// ─── Build a rotated vehicle DivIcon ────────────────────────────────────────
function createVehicleIcon(color, bearing) {
  const rotation = Math.round(bearing);
  return L.divIcon({
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `
      <div style="
        position: relative;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: ${color};
          border: 2.5px solid #f8fafc;
          box-shadow: 0 0 12px ${color}88, 0 0 24px ${color}44;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24"
               style="transform: rotate(${rotation}deg); transition: transform 0.4s ease;"
               fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2 L12 22"/>
            <path d="M5 9 L12 2 L19 9"/>
          </svg>
        </div>
      </div>
    `,
  });
}

// ─── Fly-to controller ──────────────────────────────────────────────────────
function MapController({ demoState, onFlyInComplete }) {
  const map = useMap();
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (demoState === 'flyIn' && !hasFiredRef.current) {
      hasFiredRef.current = true;

      // Start from a wide overview
      map.setView([19.0, 72.8], 10, { animate: false });

      // Fly into Mumbai center
      setTimeout(() => {
        map.flyTo([19.06, 72.86], 13, { duration: 3 });

        // Notify parent when the animation finishes
        setTimeout(() => {
          if (onFlyInComplete) onFlyInComplete();
        }, 3200);
      }, 300);
    }

    // Reset if we go back to setup
    if (demoState === 'setup') {
      hasFiredRef.current = false;
      map.setView([19.0, 72.8], 10, { animate: false });
    }
  }, [demoState, map, onFlyInComplete]);

  return null;
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function LiveMap({ data, routingMode, demoState, onFlyInComplete, scenario, speedMultiplier }) {
  if (!data?.nodes || !data?.vehicles) {
    return <div className="empty-state">Awaiting Mumbai telemetry stream...</div>;
  }

  const { nodes, vehicles, state } = data;

  // ── OSRM road snapping ──
  const snappedRoutes = useOSRMRoutes(vehicles, nodes, routingMode);

  // ── Client-side polyline animation state ──
  // Stores { [vehicleId]: { km: number, arrived: boolean } }
  const [animProgress, setAnimProgress] = useState({});
  const animRef = useRef(null);
  const lastTickRef = useRef(Date.now());
  const speedMultRef = useRef(speedMultiplier ?? 1.0);

  // Keep the speed multiplier ref in sync with props — NO position reset
  useEffect(() => {
    speedMultRef.current = speedMultiplier ?? 1.0;
  }, [speedMultiplier]);

  // ── Precompute route totals for arrival detection in the animation loop ──
  const routeTotalsRef = useRef({});
  useEffect(() => {
    const totals = {};
    for (const vehicle of vehicles) {
      const snapped = snappedRoutes[vehicle.id];
      const positions = routingMode === 'AI'
        ? (snapped?.ai || fallbackPositions(vehicle.ai, nodes))
        : (snapped?.baseline || fallbackPositions(vehicle.baseline, nodes));
      if (positions.length >= 2) {
        const cumDists = cumulativeDistances(positions);
        totals[vehicle.id] = cumDists[cumDists.length - 1];
      }
    }
    routeTotalsRef.current = totals;
  }, [vehicles, snappedRoutes, routingMode, nodes]);

  // ── Animation loop ──
  useEffect(() => {
    const isLive = !demoState || demoState === 'live';
    if (!isLive) {
      // Paused — don't animate
      if (animRef.current) cancelAnimationFrame(animRef.current);
      lastTickRef.current = Date.now();
      return;
    }

    function tick() {
      const now = Date.now();
      const dt = (now - lastTickRef.current) / 1000; // seconds
      lastTickRef.current = now;

      setAnimProgress((prev) => {
        const next = { ...prev };
        for (const vehicle of vehicles) {
          const entry = next[vehicle.id] || { km: 0, arrived: false };

          // If already arrived, skip — don't keep calculating
          if (entry.arrived) {
            next[vehicle.id] = entry;
            continue;
          }

          const backendSpeed = vehicle.telemetry?.speed_kmh || 0;
          if (backendSpeed <= 0) {
            next[vehicle.id] = entry;
            continue;
          }

          // Apply scenario speed multiplier and time-scale for visible movement
          const effectiveSpeed = backendSpeed * speedMultRef.current;
          const distDelta = (effectiveSpeed / 3600) * dt * 180; // 180x time scale

          let newKm = entry.km + distDelta;

          // Terminal check: has the vehicle reached the end of the route?
          const routeTotal = routeTotalsRef.current[vehicle.id] || Infinity;
          let arrived = false;
          if (routeTotal - newKm < 0.05) {
            // Snap to end, mark as arrived
            newKm = routeTotal;
            arrived = true;
          }

          next[vehicle.id] = { km: newKm, arrived };
        }
        return next;
      });

      animRef.current = requestAnimationFrame(tick);
    }

    lastTickRef.current = Date.now();
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [demoState, vehicles]);

  // ── Reset progress ONLY on explicit reset, not on scenario changes ──
  useEffect(() => {
    if (scenario === 'reset') {
      setAnimProgress({});
    }
    // 'rain', 'flood', 'low_fuel', 'normal' do NOT reset — only speed changes
  }, [scenario]);

  // ── Pre-compute all route + marker data ──
  const renderData = useMemo(() => {
    return vehicles.map((vehicle) => {
      const snapped = snappedRoutes[vehicle.id];

      // Use OSRM-snapped positions if available, fall back to raw coordinates
      const aiPositions = snapped?.ai || fallbackPositions(vehicle.ai, nodes);
      const baselinePositions = snapped?.baseline || fallbackPositions(vehicle.baseline, nodes);
      const activePositions = routingMode === 'AI' ? aiPositions : baselinePositions;

      const diverged =
        vehicle.baseline.path.join('>') !== vehicle.ai.path.join('>') &&
        vehicle.baseline.path.length > 1;

      // ── Snap vehicle marker to the OSRM polyline ──
      let markerPos = null;
      let bearing = 0;
      const backendCoord = vehicle.telemetry?.coordinate;

      const animEntry = animProgress[vehicle.id] || { km: 0, arrived: false };
      const hasArrived = animEntry.arrived;

      if (activePositions.length >= 2) {
        const cumDists = cumulativeDistances(activePositions);
        const totalRouteKm = cumDists[cumDists.length - 1];
        const travelledKm = animEntry.km;

        // Clamp to route length
        const clampedKm = Math.min(travelledKm, totalRouteKm);
        const interp = interpolateAlongPolyline(activePositions, cumDists, clampedKm);

        if (interp) {
          markerPos = interp.pos;

          // Bearing: point toward the next waypoint on the polyline
          const nextIdx = Math.min(interp.segIdx + 1, activePositions.length - 1);
          bearing = computeBearing(interp.pos, activePositions[nextIdx]);
        } else if (backendCoord) {
          markerPos = [backendCoord.lat, backendCoord.lng];
        }

      } else if (backendCoord) {
        markerPos = [backendCoord.lat, backendCoord.lng];
      }

      // ── ETA: compute from client-side polyline distance, not backend ──
      const speed = vehicle.telemetry?.speed_kmh || 0;
      const effectiveSpeed = speed * (speedMultiplier ?? 1.0);
      let etaMinutes = 0;

      if (hasArrived) {
        // Explicitly zero — vehicle is at destination
        etaMinutes = 0;
      } else if (activePositions.length >= 2 && effectiveSpeed > 0) {
        const cumDists = cumulativeDistances(activePositions);
        const totalRouteKm = cumDists[cumDists.length - 1];
        const clientRemaining = Math.max(0, totalRouteKm - animEntry.km);
        if (clientRemaining < 0.05) {
          etaMinutes = 0;
        } else {
          etaMinutes = Math.round((clientRemaining / effectiveSpeed) * 60);
        }
      }

      return {
        id: vehicle.id,
        color: vehicle.color,
        aiPositions,
        baselinePositions,
        activePositions,
        diverged,
        ai: vehicle.ai,
        baseline: vehicle.baseline,
        telemetry: vehicle.telemetry,
        markerPos,
        bearing,
        etaMinutes,
        hasArrived,
        speed: Math.round(effectiveSpeed),
      };
    });
  }, [vehicles, nodes, routingMode, snappedRoutes, animProgress, speedMultiplier]);

  const isLive = !demoState || demoState === 'live';
  const initialCenter = demoState === 'setup' ? [19.0, 72.8] : [19.06, 72.86];
  const initialZoom = demoState === 'setup' ? 10 : 13;

  // Route color override for flood scenario
  const isFlood = scenario === 'flood';

  return (
    <div className="map-shell">
      {state?.frozen && <div className="event-overlay">Recomputing under live disruption</div>}

      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CARTO"
        />

        {/* Fly-to animation controller */}
        <MapController demoState={demoState} onFlyInComplete={onFlyInComplete} />

        {/* Route polylines */}
        {renderData.map((rd) => (
          <React.Fragment key={rd.id}>
            {/* Divergence baseline ghost line */}
            {rd.diverged && routingMode === 'AI' && rd.baselinePositions.length >= 2 && (
              <Polyline
                positions={rd.baselinePositions}
                pathOptions={{
                  color: '#f97316',
                  opacity: 0.3,
                  weight: 4,
                  dashArray: '12, 10',
                }}
              >
                <Tooltip sticky>
                  <div>
                    <strong>Baseline Divergence</strong>
                    <div>{rd.baseline.rejected_reason}</div>
                  </div>
                </Tooltip>
              </Polyline>
            )}

            {/* Active route — flood turns it red */}
            {rd.activePositions.length >= 2 && (
              <Polyline
                positions={rd.activePositions}
                pathOptions={{
                  color: isFlood ? '#ef4444' : (routingMode === 'AI' ? rd.color : '#94a3b8'),
                  opacity: 0.95,
                  weight: isFlood ? 7 : 6,
                }}
              >
                <Tooltip sticky>
                  <div>
                    <strong>{rd.id}</strong>
                    <div>{routingMode === 'AI' ? 'AI route' : 'Baseline route'}</div>
                    <div>
                      {routingMode === 'AI'
                        ? `${rd.ai.predicted_time} min | ${rd.ai.max_risk}% risk`
                        : `${rd.baseline.true_time} min`}
                    </div>
                    {isFlood && <div style={{ color: '#ef4444', fontWeight: 700 }}>⚠ FLOOD ZONE</div>}
                  </div>
                </Tooltip>
              </Polyline>
            )}

            {/* Alternate route ghost */}
            {routingMode === 'BASELINE' && rd.aiPositions.length >= 2 && (
              <Polyline
                positions={rd.aiPositions}
                pathOptions={{
                  color: rd.color,
                  opacity: 0.25,
                  weight: 4,
                  dashArray: '6, 8',
                }}
              />
            )}
          </React.Fragment>
        ))}

        {/* Node dots */}
        {Object.entries(nodes).map(([nodeId, node]) => (
          <CircleMarker
            key={nodeId}
            center={[node.lat, node.lng]}
            radius={4}
            pathOptions={{
              color: 'rgba(255,255,255,0.15)',
              fillColor: '#08111d',
              fillOpacity: 0.85,
              weight: 1,
            }}
          >
            <Tooltip>{node.name}</Tooltip>
          </CircleMarker>
        ))}

        {/* Vehicle markers — snapped to polyline, rotated, with ETA */}
        {isLive &&
          renderData.map((rd) => {
            if (!rd.markerPos) return null;

            const icon = createVehicleIcon(rd.color, rd.bearing);

            return (
              <Marker
                key={`vehicle-${rd.id}`}
                position={rd.markerPos}
                icon={icon}
              >
                <Tooltip direction="top" permanent offset={[0, -22]}>
                  <div>
                    <strong>{rd.id}</strong>
                    <div>{rd.telemetry.location_label}</div>
                    <div>{rd.hasArrived ? '0' : rd.speed} km/h</div>
                    <div style={{ color: rd.hasArrived ? '#3fbd7c' : '#3ab3d8', fontWeight: 600 }}>
                      {rd.hasArrived ? '✓ Arrived' : rd.etaMinutes > 0 ? `ETA: ${rd.etaMinutes} min` : ''}
                    </div>
                  </div>
                </Tooltip>
              </Marker>
            );
          })}
      </MapContainer>
    </div>
  );
}

/** Fallback: extract positions from coordinate array or path+nodes */
function fallbackPositions(route, nodes) {
  if (route?.coordinates?.length >= 2) {
    return route.coordinates.map((p) => [p.lat, p.lng]);
  }
  if (route?.path?.length >= 2 && nodes) {
    return route.path
      .map((nodeId) => {
        const node = nodes[nodeId];
        return node ? [node.lat, node.lng] : null;
      })
      .filter(Boolean);
  }
  return [];
}
