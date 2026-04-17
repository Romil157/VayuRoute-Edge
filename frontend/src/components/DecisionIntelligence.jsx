import React from 'react';

export default function DecisionIntelligence({ data, routingMode }) {
  if (!data || !data.vehicles) return null;

  return (
    <div className="glass-panel">
      <h2>Decision Intelligence</h2>
      {data.vehicles.map((v, i) => (
        <div key={v.id} style={{ marginBottom: i > 0 ? 0 : '1rem', paddingBottom: i === 0 ? '1rem' : 0, borderBottom: i === 0 ? '1px solid rgba(48,54,61,0.5)' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
            <span style={{ color: '#c9d1d9', fontSize: '0.9rem', fontWeight: 600 }}>Vehicle {v.id} Logic</span>
            <span style={{ fontSize: '0.75rem', background: 'rgba(88,166,255,0.1)', color: '#58a6ff', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              {v.ai.confidence}% AI Confidence
            </span>
          </div>

          <div className="stat-row">
            <span className="stat-label">Path Max Risk ({data.state.horizon}m):</span>
            <span className={v.ai.max_risk > 50 ? 'risk-high' : v.ai.max_risk > 20 ? 'risk-mid' : 'risk-low'}>
              {v.ai.max_risk}%
            </span>
          </div>
          
          <div className="stat-row">
            <span className="stat-label">Live Fuel Reserve:</span>
            <span className={v.fuel < 20 ? 'risk-high' : 'risk-low'}>
              {v.fuel}%
            </span>
          </div>
          
          <div style={{ marginTop: '0.8rem', padding: '0.6rem', background: 'rgba(33, 38, 45, 0.5)', borderRadius: '6px', borderLeft: routingMode === 'AI' ? '3px solid #58a6ff' : '3px solid #8b949e' }}>
            <strong style={{ fontSize: '0.8rem', color: '#c9d1d9' }}>{routingMode === 'AI' ? 'AI Explanation:' : 'Baseline Behavior:'}</strong>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#8b949e' }}>
               {routingMode === 'AI' ? v.ai.reason : 'Ignoring predictive conditions. Pathing blindly via default weights.'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
