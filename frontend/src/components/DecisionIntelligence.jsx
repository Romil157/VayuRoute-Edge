import React from 'react';

export default function DecisionIntelligence({ data, routingMode }) {
  if (!data?.vehicles?.length) {
    return null;
  }

  const anyDispatched = data.vehicles.some(
    (vehicle) => vehicle.dispatched || vehicle.telemetry?.status !== 'Idle'
  );

  if (!anyDispatched) {
    return (
      <div className="glass-panel">
        <h2>Decision Intelligence</h2>
        <p className="panel-copy">Awaiting dispatch</p>
      </div>
    );
  }

  return (
    <div className="glass-panel">
      <h2>Decision Intelligence</h2>
      <div className="stack-list">
        {data.vehicles.map((vehicle) => (
          <div key={vehicle.id} className="subpanel">
            <div className="subpanel-header">
              <strong>{vehicle.id}</strong>
              <span>{(vehicle.ai.policy || 'RiskAwareRouter').replace('DQN', 'RiskAwareRouter')} policy</span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Route Score</span>
              <span>{vehicle.ai.q_value}</span>
            </div>

            <div className="stat-row">
              <span className="stat-label">AI Confidence</span>
              <span>{vehicle.ai.confidence}%</span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Projected AI Time</span>
              <span>{vehicle.ai.predicted_time} min</span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Maximum Risk</span>
              <span>{vehicle.ai.max_risk}%</span>
            </div>

            <p className="panel-copy">
              {routingMode === 'AI'
                ? vehicle.ai.reason
                : vehicle.baseline.rejected_reason}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
