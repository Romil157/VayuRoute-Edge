import React from 'react';

export default function BusinessImpact({ metrics }) {
  if (!metrics) {
    return null;
  }

  const dispatched = metrics.dispatch_count > 0;
  const hasArrivals = metrics.deliveries_completed > 0;

  if (!dispatched) {
    return (
      <div className="glass-panel">
        <h2>Operations Impact</h2>
        <p className="panel-copy panel-subtitle">Awaiting dispatch</p>
        <div className="impact-grid">
          <div className="impact-tile">
            <span className="impact-label">Cost Delta</span>
            <strong>--</strong>
          </div>
          <div className="impact-tile">
            <span className="impact-label">Time Saved</span>
            <strong>--</strong>
          </div>
          <div className="impact-tile">
            <span className="impact-label">Fuel Saved</span>
            <strong>--</strong>
          </div>
          <div className="impact-tile">
            <span className="impact-label">SLA Breaches Avoided</span>
            <strong>--</strong>
          </div>
        </div>
      </div>
    );
  }

  const subtitle = hasArrivals ? null : 'Projected';

  return (
    <div className="glass-panel">
      <h2>Operations Impact</h2>
      {subtitle && <p className="panel-copy panel-subtitle">{subtitle}</p>}

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
          <span className="impact-label">SLA Breaches Avoided</span>
          <strong>{metrics.sla_breached_baseline ?? 0}</strong>
        </div>
      </div>

      <div className="stat-row">
        <span className="stat-label">Efficiency</span>
        <span>{metrics.efficiency_percentage}%</span>
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
