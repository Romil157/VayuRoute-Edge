import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function LiveMap({ data, routingMode }) {
  const [frozenClass, setFrozenClass] = useState('');

  useEffect(() => {
    if (data?.state?.frozen) {
      setFrozenClass('screen-dim');
      const timer = setTimeout(() => setFrozenClass(''), 1500);
      return () => clearTimeout(timer);
    }
  }, [data?.state?.frozen]);

  if (!data || !data.nodes) return <div style={{color:'white', padding: '2rem'}}>Awaiting AI Telemetry...</div>;

  const { nodes, predicted_graph, vehicles, state } = data;

  const getEdgeColor = (risk) => {
    if (risk > 50) return '#f85149';
    if (risk > 20) return '#d29922';
    return '#3fb950';
  };

  return (
    <div className={`map-wrapper ${frozenClass}`} style={{ height: '100%', width: '100%', position: 'absolute', backgroundColor: '#02040a' }}>
      
      {data.state.frozen && (
        <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 2000, background: 'rgba(2, 4, 10, 0.8)', padding: '1rem 2rem', borderRadius: '8px', border: '1px solid #da3633', color: '#ff7b72', fontSize: '1.2rem', fontWeight: 'bold', backdropFilter: 'blur(10px)', boxShadow: '0 0 30px rgba(218, 54, 51, 0.4)' }}>
           PREDICTING NETWORK FAILURE...
        </div>
      )}

      <MapContainer 
        center={[19.0600, 72.8400]} 
        zoom={12} 
        style={{ height: '100%', width: '100%', background: 'transparent' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; CARTO'
        />
        
        {/* Predictive Edges Heatmap */}
        {predicted_graph.map((edge, idx) => {
          const n1 = nodes[edge.source];
          const n2 = nodes[edge.target];
          return (
            <Polyline 
              key={`bg-${idx}`}
              positions={[[n1.lat, n1.lng], [n2.lat, n2.lng]]}
              pathOptions={{
                color: getEdgeColor(edge.risk),
                weight: edge.risk > 50 ? 5 : 3,
                opacity: edge.risk > 50 ? 0.6 : 0.3,
                dashArray: '5, 10'
              }}
            />
          );
        })}

        {/* Selected Routes & Rejected Route Hover */}
        {vehicles.map((v, i) => {
          const pathKeys = routingMode === 'AI' ? v.ai.path : v.baseline.path;
          if (!pathKeys || pathKeys.length === 0) return null;
          const positions = pathKeys.map(k => [nodes[k].lat, nodes[k].lng]);
          
          let rejectedPoly = null;
          if (routingMode === 'AI' && v.baseline.path.length > 0 && v.baseline.path.join() !== v.ai.path.join()) {
             const bPos = v.baseline.path.map(k => [nodes[k].lat, nodes[k].lng]);
             rejectedPoly = (
               <Polyline positions={bPos} pathOptions={{ color: '#da3633', weight: 4, opacity: 0.2, dashArray: '4, 12' }}>
                  <Tooltip sticky>
                     <div style={{ color: '#da3633', fontWeight: 'bold' }}>{v.baseline.rejected_reason}</div>
                  </Tooltip>
               </Polyline>
             );
          }

          return (
            <React.Fragment key={`routes-${v.id}`}>
              {rejectedPoly}
              <Polyline
                positions={positions}
                pathOptions={{
                  color: routingMode === 'AI' ? (i===0 ? '#58a6ff' : '#a371f7') : '#8b949e',
                  weight: 6,
                  opacity: 0.9,
                  dashArray: routingMode === 'AI' ? null : '10, 10'
                }}
              />
            </React.Fragment>
          );
        })}

        {/* Base Nodes & Multi-Stop Waypoints */}
        {Object.keys(nodes).map(key => {
            const isStart = vehicles[0].pos === key;
            const isEnd = vehicles[0].target === key;
            const isStop = vehicles[0].stops.find(s => s.id === key);
            
            let color = '#30363d';
            let fill = '#0d1117';
            let radius = 5;
            
            if (isStart) { color = '#3fb950'; fill = '#238636'; radius = 8; }
            else if (isEnd) { color = '#f85149'; fill = '#da3633'; radius = 8; }
            else if (isStop) { color = '#58a6ff'; fill = '#1f6feb'; radius = 7; }

            return (
              <CircleMarker 
                key={key}
                center={[nodes[key].lat, nodes[key].lng]}
                radius={radius}
                pathOptions={{ color, fillColor: fill, fillOpacity: 0.8 }}
              >
                <Tooltip direction="top" opacity={0.9} permanent={isStart || isEnd || isStop}>
                  <span style={{color: '#c9d1d9', fontWeight: 600, background: '#0d1117'}}>
                    {isStart ? "Start: " : isEnd ? "Target: " : isStop ? "Stop: " : ""}
                    {nodes[key].name}
                  </span>
                </Tooltip>
              </CircleMarker>
            );
        })}

        {/* Vehicles */}
        {vehicles.map((v, i) => (
           <CircleMarker
              key={`veh-${v.id}`}
              center={[nodes[v.pos].lat, nodes[v.pos].lng]}
              radius={10}
              pathOptions={{ 
                color: i===0 ? '#58a6ff' : '#a371f7', 
                fillColor: i===0 ? '#1f6feb' : '#8957e5', 
                fillOpacity: 0.8 
              }}
           >
              <Tooltip direction="bottom" permanent opacity={1}>
                <span style={{fontWeight:'bold', color: 'black'}}>{v.id}</span>
              </Tooltip>
           </CircleMarker>
        ))}

      </MapContainer>
    </div>
  );
}
