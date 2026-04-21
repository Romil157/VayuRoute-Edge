import React from 'react';

export default function RouteAlternatives({ v1_ai }) {
  if (!v1_ai?.alternatives?.length) {
    return null;
  }

  return (
    <div className="glass-panel">
      <h2>Alternative Policies</h2>
      <div className="stack-list">
        {v1_ai.alternatives.map((alternative, index) => (
          <div key={`${alternative.type}-${index}`} className="subpanel">
            <div className="subpanel-header">
              <strong>{alternative.type}</strong>
              <span>{alternative.confidence}% confidence</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Time</span>
              <span>{alternative.cost_function?.Time ?? alternative.time} min</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Risk</span>
              <span>{alternative.cost_function?.Risk ?? alternative.risk}%</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Score</span>
              <span>{alternative.cost_function?.score ?? alternative.cost}</span>
            </div>
            <p className="panel-copy">{alternative.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
