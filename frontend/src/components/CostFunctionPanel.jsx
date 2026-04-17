import React from 'react';

export default function CostFunctionPanel({ v1_ai }) {
  if (!v1_ai || !v1_ai.cost_function) return null;
  const cf = v1_ai.cost_function;

  return (
    <div className="glass-panel">
      <h2>DQN Cost Function Diagnostics</h2>
      
      <div style={{ padding: '0.8rem', background: 'rgba(33, 38, 45, 0.4)', borderRadius: '6px', textAlign: 'center', marginBottom: '1rem', border: '1px solid #58a6ff' }}>
         <span style={{ display: 'block', fontSize: '0.8rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '1px' }}>Global Algorithmic Score</span>
         <span style={{ fontSize: '1.6rem', color: '#58a6ff', fontWeight: 'bold' }}>{cf.score}</span>
      </div>

      <div className="stat-row">
        <span className="stat-label">Temporal Distance (Min):</span>
        <span style={{ color: '#c9d1d9', fontWeight: 600 }}>{cf.Time}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Predictive Risk Exposure:</span>
        <span style={{ color: '#d29922', fontWeight: 600 }}>{cf.Risk}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Estimated Fuel Loss:</span>
        <span style={{ color: '#c9d1d9', fontWeight: 600 }}>{cf.Fuel}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">SLA / Priority Penalty:</span>
        <span style={{ color: cf.Priority > 0 ? '#ff7b72' : '#3fb950', fontWeight: 600 }}>{cf.Priority}</span>
      </div>
      
      <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#8b949e', textAlign: 'center' }}>
          Equation: Σ(T + 1.5[R&gt;50] + 0.2[T] + P_weight)
      </div>
    </div>
  );
}
