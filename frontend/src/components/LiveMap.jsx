import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useOSRMRoutes } from '../hooks/useOSRMRoutes';

function haversineKm(a, b) {
  const radiusKm = 6371;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return radiusKm * 2 * Math.asin(Math.sqrt(sin2));
}

function cumulativeDistances(positions) {
  const distances = [0];
  for (let index = 1; index < positions.length; index += 1) {
    distances.push(distances[index - 1] + haversineKm(positions[index - 1], positions[index]));
  }
  return distances;
}

function interpolateAlongPolyline(positions, cumulative, targetKm) {
  if (!positions.length) {
    return null;
  }
  if (targetKm <= 0) {
    return { pos: positions[0], segIdx: 0 };
  }

  const totalDistance = cumulative[cumulative.length - 1];
  if (targetKm >= totalDistance) {
    return { pos: positions[positions.length - 1], segIdx: Math.max(0, positions.length - 2) };
  }

  let low = 0;
  let high = cumulative.length - 1;
  while (low < high - 1) {
    const mid = (low + high) >> 1;
    if (cumulative[mid] <= targetKm) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const segmentLength = cumulative[high] - cumulative[low];
  const ratio = segmentLength > 0 ? (targetKm - cumulative[low]) / segmentLength : 0;
  const start = positions[low];
  const end = positions[high];

  return {
    pos: [
      start[0] + (end[0] - start[0]) * ratio,
      start[1] + (end[1] - start[1]) * ratio,
    ],
    segIdx: low,
  };
}

function computeBearing(from, to) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const toDeg = (radians) => (radians * 180) / Math.PI;

  const lat1 = toRad(from[0]);
  const lat2 = toRad(to[0]);
  const deltaLng = toRad(to[1] - from[1]);

  const x = Math.sin(deltaLng) * Math.cos(lat2);
  const y =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  return (toDeg(Math.atan2(x, y)) + 360) % 360;
}

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

function projectPointOnSegment(point, start, end) {
  const vx = end[1] - start[1];
  const vy = end[0] - start[0];
  const wx = point[1] - start[1];
  const wy = point[0] - start[0];
  const lengthSquared = vx * vx + vy * vy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / lengthSquared));

  const projected = [
    start[0] + (end[0] - start[0]) * t,
    start[1] + (end[1] - start[1]) * t,
  ];

  return {
    t,
    position: projected,
    distanceKm: haversineKm(point, projected),
  };
}

function projectPointOnPolyline(point, positions, cumulative) {
  if (!point || positions.length < 2 || cumulative.length < 2) {
    return 0;
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestKm = 0;

  for (let index = 0; index < positions.length - 1; index += 1) {
    const start = positions[index];
    const end = positions[index + 1];
    const projection = projectPointOnSegment(point, start, end);
    if (projection.distanceKm < bestDistance) {
      bestDistance = projection.distanceKm;
      bestKm = cumulative[index] + haversineKm(start, projection.position);
    }
  }

  return bestKm;
}

function fallbackTargetKm(vehicle, positions, cumulative) {
  const totalRouteKm = cumulative[cumulative.length - 1] || 0;
  const routeProgress = Number(vehicle?.telemetry?.route_progress ?? 0);

  if (totalRouteKm > 0 && Number.isFinite(routeProgress)) {
    return totalRouteKm * Math.max(0, Math.min(100, routeProgress)) / 100;
  }

  const backendCoordinate = vehicle?.telemetry?.coordinate;
  if (backendCoordinate) {
    return projectPointOnPolyline([backendCoordinate.lat, backendCoordinate.lng], positions, cumulative);
  }

  return 0;
}

function MapController({ demoState, onFlyInComplete }) {
  const map = useMap();
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (demoState === 'flyIn' && !hasFiredRef.current) {
      hasFiredRef.current = true;
      map.setView([19.0, 72.8], 10, { animate: false });

      const flyInTimer = window.setTimeout(() => {
        map.flyTo([19.06, 72.86], 13, { duration: 3 });
      }, 300);

      const doneTimer = window.setTimeout(() => {
        if (onFlyInComplete) {
          onFlyInComplete();
        }
      }, 3500);

      return () => {
        window.clearTimeout(flyInTimer);
        window.clearTimeout(doneTimer);
      };
    }

    if (demoState === 'setup') {
      hasFiredRef.current = false;
      map.setView([19.0, 72.8], 10, { animate: false });
    }

    return undefined;
  }, [demoState, map, onFlyInComplete]);

  return null;
}

function MapResizeController({ isFullscreen }) {
  const map = useMap();

  useEffect(() => {
    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 180);

    return () => {
      window.clearTimeout(resizeTimer);
    };
  }, [isFullscreen, map]);

  return null;
}

export default function LiveMap({
  data,
  routingMode,
  demoState,
  onFlyInComplete,
  scenario,
  onFullscreenChange,
  vehicleControls = {},
}) {
  const nodes = data?.nodes;
  const vehicles = useMemo(() => data?.vehicles ?? [], [data?.vehicles]);
  const state = data?.state;
  const snappedRoutes = useOSRMRoutes(vehicles, nodes, routingMode);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [displayProgress, setDisplayProgress] = useState({});
  const routeMetaRef = useRef([]);
  const vehicleControlsRef = useRef(vehicleControls);
  const routeKeysRef = useRef({});
  const appliedResetTokensRef = useRef({});

  useEffect(() => {
    vehicleControlsRef.current = vehicleControls;
  }, [vehicleControls]);

  useEffect(() => {
    if (onFullscreenChange) {
      onFullscreenChange(isFullscreen);
    }
  }, [isFullscreen, onFullscreenChange]);

  useEffect(() => () => {
    if (onFullscreenChange) {
      onFullscreenChange(false);
    }
  }, [onFullscreenChange]);

  const routeMeta = useMemo(() => (
    vehicles.map((vehicle) => {
      const snapped = snappedRoutes[vehicle.id];
      const aiPositions = snapped?.ai || fallbackPositions(vehicle.ai, nodes);
      const baselinePositions = snapped?.baseline || fallbackPositions(vehicle.baseline, nodes);
      const activePositions = routingMode === 'AI' ? aiPositions : baselinePositions;
      const cumulative = activePositions.length >= 2 ? cumulativeDistances(activePositions) : [0];
      const totalRouteKm = cumulative[cumulative.length - 1] || 0;
      const targetKm = activePositions.length >= 2
        ? fallbackTargetKm(vehicle, activePositions, cumulative)
        : 0;
      const activePath = routingMode === 'AI' ? vehicle.ai?.path : vehicle.baseline?.path;

      return {
        id: vehicle.id,
        color: vehicle.color,
        aiPositions,
        baselinePositions,
        activePositions,
        diverged:
          vehicle.baseline.path.join('>') !== vehicle.ai.path.join('>') &&
          vehicle.baseline.path.length > 1,
        ai: vehicle.ai,
        baseline: vehicle.baseline,
        telemetry: vehicle.telemetry,
        cumulative,
        totalRouteKm,
        targetKm,
        routeKey: `${routingMode}:${activePath?.join('>') || vehicle.id}`,
      };
    })
  ), [nodes, routingMode, snappedRoutes, vehicles]);

  useEffect(() => {
    routeMetaRef.current = routeMeta;
  }, [routeMeta]);

  useEffect(() => {
    setDisplayProgress((current) => {
      let changed = false;
      const next = {};
      const activeIds = new Set(routeMeta.map((meta) => meta.id));

      for (const meta of routeMeta) {
        const previousKm = current[meta.id];
        const previousRouteKey = routeKeysRef.current[meta.id];
        const routeRestarted = typeof previousKm === 'number' && meta.targetKm + 0.05 < previousKm;
        const nextKm =
          previousRouteKey !== meta.routeKey ||
          typeof previousKm !== 'number' ||
          routeRestarted ||
          previousKm > meta.totalRouteKm + 0.001
            ? meta.targetKm
            : previousKm;

        next[meta.id] = nextKm;
        routeKeysRef.current[meta.id] = meta.routeKey;
        appliedResetTokensRef.current[meta.id] ??= vehicleControls[meta.id]?.resetToken ?? 0;

        if (nextKm !== previousKm) {
          changed = true;
        }
      }

      for (const vehicleId of Object.keys(routeKeysRef.current)) {
        if (!activeIds.has(vehicleId)) {
          delete routeKeysRef.current[vehicleId];
          delete appliedResetTokensRef.current[vehicleId];
        }
      }

      if (Object.keys(current).length !== routeMeta.length) {
        changed = true;
      }

      return changed ? next : current;
    });
  }, [routeMeta, vehicleControls]);

  useEffect(() => {
    setDisplayProgress((current) => {
      let changed = false;
      const next = { ...current };

      for (const meta of routeMeta) {
        const resetToken = vehicleControls[meta.id]?.resetToken ?? 0;
        if ((appliedResetTokensRef.current[meta.id] ?? 0) !== resetToken) {
          next[meta.id] = 0;
          appliedResetTokensRef.current[meta.id] = resetToken;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [routeMeta, vehicleControls]);

  useEffect(() => {
    if (scenario === 'reset') {
      setDisplayProgress((current) => {
        const next = { ...current };
        for (const meta of routeMetaRef.current) {
          next[meta.id] = 0;
        }
        return next;
      });
    }
  }, [scenario]);

  useEffect(() => {
    const isLive = !demoState || demoState === 'live';
    if (!isLive) {
      return undefined;
    }

    let frameId = 0;
    let lastTime = performance.now();

    const tick = (now) => {
      const dt = Math.max(0.001, (now - lastTime) / 1000);
      lastTime = now;

      setDisplayProgress((current) => {
        let changed = false;
        const next = { ...current };

        for (const meta of routeMetaRef.current) {
          const currentKm = typeof next[meta.id] === 'number' ? next[meta.id] : meta.targetKm;
          const controlState = vehicleControlsRef.current[meta.id] || { paused: false };
          const desiredKm = controlState.paused ? currentKm : meta.targetKm;
          const diff = desiredKm - currentKm;

          if (Math.abs(diff) <= 0.001) {
            continue;
          }

          const easing = 1 - Math.exp(-dt * 6);
          let updatedKm = currentKm + diff * easing;

          if (diff > 0) {
            updatedKm = Math.min(updatedKm, desiredKm);
          } else {
            updatedKm = Math.max(updatedKm, desiredKm);
          }

          updatedKm = Math.max(0, Math.min(meta.totalRouteKm, updatedKm));

          if (Math.abs(updatedKm - currentKm) > 0.0005) {
            next[meta.id] = updatedKm;
            changed = true;
          }
        }

        return changed ? next : current;
      });

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [demoState]);

  const renderData = useMemo(() => (
    routeMeta.map((meta) => {
      const displayKm = displayProgress[meta.id] ?? meta.targetKm;
      const backendCoordinate = meta.telemetry?.coordinate;
      const controlState = vehicleControls[meta.id] || { paused: false };

      let markerPos = null;
      let bearing = 0;

      if (meta.activePositions.length >= 2) {
        const interpolated = interpolateAlongPolyline(meta.activePositions, meta.cumulative, displayKm);
        if (interpolated) {
          markerPos = interpolated.pos;
          const nextIndex = Math.min(interpolated.segIdx + 1, meta.activePositions.length - 1);
          bearing = computeBearing(interpolated.pos, meta.activePositions[nextIndex]);
        }
      } else if (backendCoordinate) {
        markerPos = [backendCoordinate.lat, backendCoordinate.lng];
      }

      const remainingKm = Math.max(0, meta.totalRouteKm - displayKm);
      const speed = controlState.paused ? 0 : Math.round(meta.telemetry?.speed_kmh || 0);
      const arrived =
        meta.totalRouteKm > 0
          ? remainingKm < 0.02 || meta.telemetry?.status === 'Arrived'
          : meta.telemetry?.status === 'Arrived';
      const etaMinutes =
        arrived || speed <= 0
          ? 0
          : Math.round((remainingKm / Math.max(speed, 1)) * 60);

      return {
        ...meta,
        markerPos,
        bearing,
        etaMinutes,
        displayKm,
        speed,
        paused: controlState.paused,
        hasArrived: arrived,
      };
    })
  ), [displayProgress, routeMeta, vehicleControls]);

  const isLive = !demoState || demoState === 'live';
  const initialCenter = demoState === 'setup' ? [19.0, 72.8] : [19.06, 72.86];
  const initialZoom = demoState === 'setup' ? 10 : 13;
  const isFlood = scenario === 'flood';

  if (!nodes || !vehicles.length) {
    return <div className="empty-state">Awaiting Mumbai telemetry stream...</div>;
  }

  return (
    <div className={isFullscreen ? 'map-shell fullscreen-map' : 'map-shell'}>
      <div className="map-toolbar">
        <button
          className="btn-secondary map-toolbar-button"
          type="button"
          onClick={() => setIsFullscreen((current) => !current)}
        >
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
        </button>
      </div>

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

        <MapController demoState={demoState} onFlyInComplete={onFlyInComplete} />
        <MapResizeController isFullscreen={isFullscreen} />

        {renderData.map((vehicle) => (
          <React.Fragment key={vehicle.id}>
            {vehicle.diverged && routingMode === 'AI' && vehicle.baselinePositions.length >= 2 && (
              <Polyline
                positions={vehicle.baselinePositions}
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
                    <div>{vehicle.baseline.rejected_reason}</div>
                  </div>
                </Tooltip>
              </Polyline>
            )}

            {vehicle.activePositions.length >= 2 && (
              <Polyline
                positions={vehicle.activePositions}
                pathOptions={{
                  color: isFlood ? '#ef4444' : routingMode === 'AI' ? vehicle.color : '#94a3b8',
                  opacity: 0.95,
                  weight: isFlood ? 7 : 6,
                }}
              >
                <Tooltip sticky>
                  <div>
                    <strong>{vehicle.id}</strong>
                    <div>{routingMode === 'AI' ? 'AI route' : 'Baseline route'}</div>
                    <div>
                      {routingMode === 'AI'
                        ? `${vehicle.ai.predicted_time} min | ${vehicle.ai.max_risk}% risk`
                        : `${vehicle.baseline.true_time} min`}
                    </div>
                    {isFlood && <div className="map-alert-text">Flood zone</div>}
                  </div>
                </Tooltip>
              </Polyline>
            )}

            {routingMode === 'BASELINE' && vehicle.aiPositions.length >= 2 && (
              <Polyline
                positions={vehicle.aiPositions}
                pathOptions={{
                  color: vehicle.color,
                  opacity: 0.25,
                  weight: 4,
                  dashArray: '6, 8',
                }}
              />
            )}
          </React.Fragment>
        ))}

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

        {isLive &&
          renderData.map((vehicle) => {
            if (!vehicle.markerPos) {
              return null;
            }

            const icon = createVehicleIcon(vehicle.color, vehicle.bearing);

            return (
              <Marker key={`vehicle-${vehicle.id}`} position={vehicle.markerPos} icon={icon}>
                <Tooltip direction="top" permanent offset={[0, -22]}>
                  <div>
                    <strong>{vehicle.id}</strong>
                    <div>{vehicle.telemetry.location_label}</div>
                    <div>{vehicle.paused ? 'Map paused' : `${vehicle.speed} km/h`}</div>
                    <div
                      style={{
                        color: vehicle.hasArrived ? '#3fbd7c' : '#3ab3d8',
                        fontWeight: 600,
                      }}
                    >
                      {vehicle.hasArrived
                        ? 'Arrived'
                        : vehicle.etaMinutes > 0
                          ? `ETA: ${vehicle.etaMinutes} min`
                          : ''}
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

function fallbackPositions(route, nodes) {
  if (route?.coordinates?.length >= 2) {
    return route.coordinates.map((point) => [point.lat, point.lng]);
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
