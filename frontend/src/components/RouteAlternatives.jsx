import React from 'react';

export default function RouteAlternatives({ v1_ai }) {
  if (!v1_ai || !v1_ai.alternatives || v1_ai.alternatives.length === 0) return null;

  return (
    <div className="glass-panel">
      <h2>AI Router Alternatives</h2>
      <p style={{ fontSize: '0.8rem', color: '#8b949e', marginTop: 0 }}>Showing rejected TSP permutations evaluated by RiskAwareRouter.</p>
      
      {v1_ai.alternatives.map((alt, i) => (
        <div key={i} style={{ marginBottom: i < v1_ai.alternatives.length - 1 ? '1rem' : 0, paddingBottom: i < v1_ai.alternatives.length - 1 ? '1rem' : 0, borderBottom: i < v1_ai.alternatives.length - 1 ? '1px solid rgba(48,54,61,0.5)' : 'none' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
               <span style={{ fontWeight: 600, color: alt.type === "Faster but Risky" ? '#d29922' : '#3fb950', fontSize: '0.9rem' }}>{alt.type}</span>
               <span style={{ fontSize: '0.8rem', background: 'rgba(33, 38, 45, 0.8)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>Score: {alt.cost_function.score}</span>
           </div>
           
           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#c9d1d9', marginBottom: '0.4rem' }}>
               <span>Time: {alt.time}m</span>
               <span>Risk: {alt.risk}%</span>
               <span>Fuel: {alt.cost_function.Fuel}</span>
           </div>
           
           <div style={{ fontSize: '0.8rem', color: '#ff7b72', background: 'rgba(218, 54, 51, 0.1)', padding: '0.4rem', borderRadius: '4px', marginTop: '0.4rem' }}>
              <strong>Status:</strong> {alt.reason}
           </div>
        </div>
      ))}
    </div>
  );
}
