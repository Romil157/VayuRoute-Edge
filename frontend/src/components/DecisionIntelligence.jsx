import React from 'react';

export default function DecisionIntelligence({ data, routingMode }) {
  if (!data?.vehicles?.length) {
    return null;
  }

  return (
    <div className="glass-panel">
      <h2>Decision Intelligence</h2>
      <div className="stack-list">
        {data.vehicles.map((vehicle) => (
          <div key={vehicle.id} className="subpanel">
            <div className="subpanel-header">
              <strong>{vehicle.id}</strong>
              <span>{vehicle.ai.policy} policy</span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Q-Value</span>
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
