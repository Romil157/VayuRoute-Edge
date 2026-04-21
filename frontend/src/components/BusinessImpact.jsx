import React from 'react';

export default function BusinessImpact({ metrics }) {
  if (!metrics) {
    return null;
  }

  return (
    <div className="glass-panel">
      <h2>Operations Impact</h2>

      <div className="impact-grid">
        <div className="impact-tile">
          <span className="impact-label">Cost Delta</span>
          <strong>INR {metrics.cost_saved.toLocaleString()}</strong>
        </div>
        <div className="impact-tile">
          <span className="impact-label">Time Saved</span>
          <strong>{metrics.time_saved_min} min</strong>
        </div>
        <div className="impact-tile">
          <span className="impact-label">Fuel Saved</span>
          <strong>{metrics.fuel_saved_l} L</strong>
        </div>
        <div className="impact-tile">
          <span className="impact-label">Efficiency</span>
          <strong>{metrics.efficiency_percentage}%</strong>
        </div>
      </div>

      <div className="stat-row">
        <span className="stat-label">Fleet Load Utilization</span>
        <span>{metrics.fleet_load_utilization}%</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Dispatches Issued</span>
        <span>{metrics.dispatch_count}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Completed Deliveries</span>
        <span>{metrics.deliveries_completed}</span>
      </div>
    </div>
  );
}
