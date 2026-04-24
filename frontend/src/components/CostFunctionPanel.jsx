import React from 'react';

export default function CostFunctionPanel({ v1_ai, weather }) {
  const cost = v1_ai?.cost_function ?? {};
  const weights = v1_ai?.selected_weights ?? { time: 0.35, risk: 0.50, fuel: 0.15 };
  const rainPct = Math.round((weather?.rain_intensity ?? 0) * 100);
  const formula = `cost = ${weights.time.toFixed(2)} * time + ${weights.risk.toFixed(2)} * risk + ${weights.fuel.toFixed(2)} * fuel`;

  return (
    <div className="glass-panel">
      <h2>STGCN + RiskAwareRouter Cost Model</h2>

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
        <span className="stat-label">Routing Mode</span>
        <span>{v1_ai?.routing_mode ?? 'BALANCED'}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Route Score</span>
        <span>{v1_ai?.q_value ?? 0}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Weather Pressure</span>
        <span>{rainPct}% rain intensity</span>
      </div>

      <p className="panel-copy">{v1_ai?.decision_reason ?? 'Using BALANCED mode by default.'}</p>
      <p className="panel-copy">{formula}</p>
    </div>
  );
}
