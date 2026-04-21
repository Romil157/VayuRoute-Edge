import React from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function edgeColor(risk) {
  if (risk >= 60) return '#ef4444';
  if (risk >= 30) return '#f59e0b';
  return '#38b26d';
}

function routePositions(coordinates = []) {
  return coordinates.map((point) => [point.lat, point.lng]);
}

export default function LiveMap({ data, routingMode }) {
  if (!data?.nodes || !data?.vehicles) {
    return <div className="empty-state">Awaiting Mumbai telemetry stream...</div>;
  }

  const { nodes, predicted_graph: predictedGraph = [], vehicles, state } = data;

  return (
    <div className="map-shell">
      {state?.frozen && <div className="event-overlay">Recomputing under live disruption</div>}

      <MapContainer
        center={[19.06, 72.85]}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CARTO"
        />

        {predictedGraph.map((edge, index) => {
          const source = nodes[edge.source];
          const target = nodes[edge.target];
          if (!source || !target) {
            return null;
          }
          return (
            <Polyline
              key={`edge-${index}`}
              positions={[
                [source.lat, source.lng],
                [target.lat, target.lng],
              ]}
              pathOptions={{
                color: edgeColor(edge.risk),
                opacity: 0.22,
                weight: edge.risk >= 60 ? 5 : 3,
                dashArray: '4, 10',
              }}
            />
          );
        })}

        {vehicles.map((vehicle) => {
          const activeRoute = routingMode === 'AI' ? vehicle.ai : vehicle.baseline;
          const activePositions = routePositions(activeRoute.coordinates);
          const baselinePositions = routePositions(vehicle.baseline.coordinates);
          const aiPositions = routePositions(vehicle.ai.coordinates);
          const diverged =
            vehicle.baseline.path.join('>') !== vehicle.ai.path.join('>') &&
            vehicle.baseline.path.length > 1;

          return (
            <React.Fragment key={vehicle.id}>
              {diverged && routingMode === 'AI' && (
                <Polyline
                  positions={baselinePositions}
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

              <Polyline
                positions={activePositions}
                pathOptions={{
                  color: routingMode === 'AI' ? vehicle.color : '#94a3b8',
                  opacity: 0.95,
                  weight: 6,
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
                  </div>
                </Tooltip>
              </Polyline>

              {routingMode === 'BASELINE' && aiPositions.length > 1 && (
                <Polyline
                  positions={aiPositions}
                  pathOptions={{
                    color: vehicle.color,
                    opacity: 0.25,
                    weight: 4,
                    dashArray: '6, 8',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}

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
