import React from 'react';

export default function BusinessImpact({ metrics }) {
  if (!metrics) return null;

  return (
    <div className="glass-panel" style={{ borderLeft: '4px solid #3fb950' }}>
      <h2 style={{ color: '#c9d1d9' }}>Business Impact ROI</h2>
      
      <div className="stat-row">
        <span className="stat-label">System Cost Saved:</span>
        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#3fb950', textShadow: '0 0 10px rgba(63,185,80,0.4)' }}>
            ₹ {metrics.cost_saved.toLocaleString()}
        </span>
      </div>
      
      <div className="stat-row">
        <span className="stat-label">Network Efficiency Delta:</span>
        <span style={{ color: '#58a6ff', fontWeight: 600 }}>
            +{metrics.efficiency_percentage}%
        </span>
      </div>

      <div className="stat-row">
        <span className="stat-label">SLA Breaches Prevented:</span>
        <span style={{ color: '#a371f7', fontWeight: 600 }}>
            {metrics.sla_breached_baseline} Deliveries
        </span>
      </div>
      
      <div className="stat-row">
        <span className="stat-label">Deliveries En-Route:</span>
        <span style={{ color: '#c9d1d9', fontWeight: 600 }}>
            {metrics.deliveries_completed} Active
        </span>
      </div>
    </div>
  );
}
