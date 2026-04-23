import { useEffect, useRef, useState } from 'react';

/**
 * Decode an encoded polyline string into an array of [lat, lng] pairs.
 * Algorithm: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/**
 * Build a cache key from an array of [lat, lng] positions.
 * Uses first and last point + length as a lightweight signature.
 */
function routeSignature(positions) {
  if (!positions || positions.length < 2) return '';
  const first = positions[0];
  const last = positions[positions.length - 1];
  return `${first[0].toFixed(4)},${first[1].toFixed(4)}-${last[0].toFixed(4)},${last[1].toFixed(4)}-${positions.length}`;
}

/**
 * Fetch a road-snapped route from the OSRM demo server.
 * Takes an array of [lat, lng] waypoints.
 * Returns an array of [lat, lng] road-snapped positions.
 */
async function fetchOSRMRoute(waypoints) {
  if (!waypoints || waypoints.length < 2) return null;

  // OSRM expects coordinates as lng,lat pairs separated by semicolons
  // We send at most 25 waypoints to stay within OSRM limits
  const step = Math.max(1, Math.floor(waypoints.length / 24));
  const sampled = [];
  for (let i = 0; i < waypoints.length; i += step) {
    sampled.push(waypoints[i]);
  }
  // Always include the last point
  const lastWp = waypoints[waypoints.length - 1];
  if (sampled[sampled.length - 1] !== lastWp) {
    sampled.push(lastWp);
  }

  const coords = sampled.map((p) => `${p[1]},${p[0]}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=polyline`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const json = await res.json();
  if (json.code !== 'Ok' || !json.routes?.[0]?.geometry) return null;

  return decodePolyline(json.routes[0].geometry);
}

/**
 * React hook that takes vehicle route data and returns OSRM-snapped positions.
 *
 * @param {Array} vehicles - Array of vehicle objects with .ai and .baseline containing .coordinates
 * @param {Object} nodes - Node lookup map { nodeId: { lat, lng, name } }
 * @param {string} routingMode - 'AI' or 'BASELINE'
 * @returns {Object} snappedRoutes - Map of vehicleId -> { active, baseline, ai } position arrays
 */
export function useOSRMRoutes(vehicles, nodes, routingMode) {
  const [snappedRoutes, setSnappedRoutes] = useState({});
  const cacheRef = useRef({});
  const pendingRef = useRef(new Set());

  useEffect(() => {
    if (!vehicles?.length) return;

    let cancelled = false;

    async function snapAll() {
      const newRoutes = {};

      for (const vehicle of vehicles) {
        const aiPositions = buildPositions(vehicle.ai, nodes);
        const baselinePositions = buildPositions(vehicle.baseline, nodes);

        const aiSig = routeSignature(aiPositions);
        const baseSig = routeSignature(baselinePositions);

        // AI route
        let snappedAi = aiPositions;
        if (aiSig && aiPositions.length >= 2) {
          if (cacheRef.current[aiSig]) {
            snappedAi = cacheRef.current[aiSig];
          } else if (!pendingRef.current.has(aiSig)) {
            pendingRef.current.add(aiSig);
            try {
              const result = await fetchOSRMRoute(aiPositions);
              if (result && result.length >= 2) {
                snappedAi = result;
                cacheRef.current[aiSig] = result;
              }
            } catch {
              // Fall back to straight-line
            }
            pendingRef.current.delete(aiSig);
          }
        }

        // Baseline route
        let snappedBaseline = baselinePositions;
        if (baseSig && baselinePositions.length >= 2) {
          if (cacheRef.current[baseSig]) {
            snappedBaseline = cacheRef.current[baseSig];
          } else if (!pendingRef.current.has(baseSig)) {
            pendingRef.current.add(baseSig);
            try {
              const result = await fetchOSRMRoute(baselinePositions);
              if (result && result.length >= 2) {
                snappedBaseline = result;
                cacheRef.current[baseSig] = result;
              }
            } catch {
              // Fall back to straight-line
            }
            pendingRef.current.delete(baseSig);
          }
        }

        newRoutes[vehicle.id] = {
          ai: snappedAi,
          baseline: snappedBaseline,
          active: routingMode === 'AI' ? snappedAi : snappedBaseline,
        };
      }

      if (!cancelled) {
        setSnappedRoutes(newRoutes);
      }
    }

    snapAll();

    return () => {
      cancelled = true;
    };
  // Only re-fetch when routes genuinely change (path signature), not every tick
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    vehicles?.map((v) => v.ai?.path?.join('>')).join('|'),
    vehicles?.map((v) => v.baseline?.path?.join('>')).join('|'),
    routingMode,
  ]);

  return snappedRoutes;
}

/** Extract [lat, lng] positions from a route object, using coordinates or path+nodes fallback */
function buildPositions(route, nodes) {
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
