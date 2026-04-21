import React from 'react';

export default function CostFunctionPanel({ v1_ai, weather }) {
  const cost = v1_ai?.cost_function ?? {};
  const rainPct = Math.round((weather?.rain_intensity ?? 0) * 100);

  return (
    <div className="glass-panel">
      <h2>STGCN + DQN Cost Model</h2>

      <div className="impact-grid">
        <div className="impact-tile">
          <span className="impact-label">Time</span>
          <strong>{cost.Time ?? 0}</strong>
        </div>
        <div className="impact-tile">
          <span className="impact-label">Risk</span>
          <strong>{cost.Risk ?? 0}</strong>
        </div>
        <div className="impact-tile">
          <span className="impact-label">Fuel</span>
          <strong>{cost.Fuel ?? 0}</strong>
        </div>
        <div className="impact-tile">
          <span className="impact-label">Score</span>
          <strong>{cost.score ?? 0}</strong>
        </div>
      </div>

      <div className="stat-row">
        <span className="stat-label">Route Confidence</span>
        <span>{v1_ai?.confidence ?? 0}%</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Policy Value</span>
        <span>{v1_ai?.q_value ?? 0}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Weather Pressure</span>
        <span>{rainPct}% rain intensity</span>
      </div>

      <p className="panel-copy">cost = 0.50 * time + 0.35 * risk + 0.15 * fuel</p>
    </div>
  );
}
