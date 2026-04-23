import React, { useMemo } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function buildPositions(route, nodes) {
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

export default function LiveMap({ data, routingMode }) {
  if (!data?.nodes || !data?.vehicles) {
    return <div className="empty-state">Awaiting Mumbai telemetry stream...</div>;
  }

  const { nodes, vehicles, state } = data;

  const routeData = useMemo(() => {
    return vehicles.map((vehicle) => {
      const aiPositions = buildPositions(vehicle.ai, nodes);
      const baselinePositions = buildPositions(vehicle.baseline, nodes);
      const activePositions = routingMode === 'AI' ? aiPositions : baselinePositions;
      const diverged =
        vehicle.baseline.path.join('>') !== vehicle.ai.path.join('>') &&
        vehicle.baseline.path.length > 1;

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
      };
    });
  }, [vehicles, nodes, routingMode]);

  return (
    <div className="map-shell">
      {state?.frozen && <div className="event-overlay">Recomputing under live disruption</div>}

      <MapContainer
        center={[19.09, 72.86]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CARTO"
        />

        {routeData.map((rd) => (
          <React.Fragment key={rd.id}>
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

            {rd.activePositions.length >= 2 && (
              <Polyline
                positions={rd.activePositions}
                pathOptions={{
                  color: routingMode === 'AI' ? rd.color : '#94a3b8',
                  opacity: 0.95,
                  weight: 6,
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
                  </div>
                </Tooltip>
              </Polyline>
            )}

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

        {vehicles.map((vehicle) => {
          const telemetryPoint = vehicle.telemetry?.coordinate;
          if (!telemetryPoint) {
            return null;
          }
          return (
            <CircleMarker
              key={`vehicle-${vehicle.id}`}
              center={[telemetryPoint.lat, telemetryPoint.lng]}
              radius={10}
              pathOptions={{
                color: '#f8fafc',
                fillColor: vehicle.color,
                fillOpacity: 0.95,
                weight: 2,
              }}
            >
              <Tooltip direction="top" permanent>
                <div>
                  <strong>{vehicle.id}</strong>
                  <div>{vehicle.telemetry.location_label}</div>
                  <div>{vehicle.telemetry.speed_kmh} km/h</div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
