import React from 'react';

export default function DeltaComparison({ data, routingMode }) {
  if (!data || !data.vehicles) return null;

  return (
    <div className="glass-panel">
      <h2>AI vs Baseline (Delta)</h2>
      {data.vehicles.map((v, i) => (
        <div key={v.id} style={{ marginBottom: i > 0 ? 0 : '1rem', paddingBottom: i === 0 ? '1rem' : 0, borderBottom: i === 0 ? '1px solid rgba(48,54,61,0.5)' : 'none' }}>
           <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#c9d1d9' }}>Vehicle {v.id} Route</h3>
           
           <div className="stat-row">
             <span className="stat-label">Time Saved:</span>
             <span className="value-highlight">+{v.ai.time_saved} min</span>
           </div>
           
           <div className="stat-row">
             <span className="stat-label">Risk Avoided:</span>
             <span className={v.baseline.true_time > v.baseline.projected_time + 4 ? 'risk-high' : data.state.event === 'rain' ? 'risk-mid' : 'risk-low'}>
               {v.baseline.true_time > v.baseline.projected_time + 4 ? 'High Flood Zone' : data.state.event === 'rain' ? 'Moderate Congestion' : 'None'}
             </span>
           </div>
           
           {routingMode === 'BASELINE' && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#ff7b72', background: 'rgba(218, 54, 51, 0.1)', padding: '0.4rem', borderRadius: '4px' }}>
                <strong>Baseline Status:</strong> Entering high-risk corridor (Blind routing)
              </div>
           )}
        </div>
      ))}
    </div>
  );
}
