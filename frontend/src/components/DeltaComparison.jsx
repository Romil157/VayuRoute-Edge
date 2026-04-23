import React from 'react';

function BaselineNarrative({ vehicle }) {
  const risk = vehicle.baseline.max_risk ?? 0;
  const slaBreach = vehicle.baseline.sla_breached;
  const highRisk = risk > 50;

  if (!highRisk && !slaBreach) {
    return null;
  }

  return (
    <div className="failure-narrative">
      <span className="narrative-label narrative-fail">Baseline Outcome</span>
      <ul className="narrative-list">
        {highRisk && <li>Enters high-risk zone ({Math.round(risk)}% risk)</li>}
        {slaBreach && <li>SLA deadline breached</li>}
        <li>Estimated delay: {vehicle.baseline.true_time} min</li>
      </ul>
    </div>
  );
}

function AiNarrative({ vehicle }) {
  const timeSaved = vehicle.ai.time_saved;
  const confidence = vehicle.ai.confidence;
  const risk = vehicle.ai.max_risk ?? 0;

  /* Always show AI Outcome for dispatched vehicles */

  return (
    <div className="success-narrative">
      <span className="narrative-label narrative-pass">AI Outcome</span>
      <ul className="narrative-list">
        {timeSaved > 0 && <li>Saved {timeSaved} min via reroute</li>}
        <li>Max risk exposure: {Math.round(risk)}%</li>
        <li>Confidence: {confidence}%</li>
        {vehicle.ai.reason && <li>{vehicle.ai.reason}</li>}
      </ul>
    </div>
  );
}

export default function DeltaComparison({ data }) {
  if (!data?.vehicles?.length) {
    return null;
  }

  const anyDispatched = data.vehicles.some(
    (vehicle) => vehicle.dispatched || vehicle.telemetry?.status !== 'Idle'
  );

  if (!anyDispatched) {
    return (
      <div className="glass-panel">
        <h2>AI vs Baseline</h2>
        <div className="stack-list">
          {data.vehicles.map((vehicle) => (
            <div key={vehicle.id} className="subpanel">
              <div className="subpanel-header">
                <strong>{vehicle.id}</strong>
                <span>Awaiting Dispatch</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Time Saved</span>
                <span>--</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Fuel Delta</span>
                <span>--</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">AI Distance</span>
                <span>--</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Baseline Distance</span>
                <span>--</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel">
      <h2>AI vs Baseline</h2>
      <div className="stack-list">
        {data.vehicles.map((vehicle) => {
          const pathDelta =
            vehicle.baseline.path.join('>') === vehicle.ai.path.join('>') ? 'Aligned' : 'Diverged';

          return (
            <div key={vehicle.id} className="subpanel">
              <div className="subpanel-header">
                <strong>{vehicle.id}</strong>
                <span className={pathDelta === 'Diverged' ? 'delta-diverged' : ''}>
                  {pathDelta}
                </span>
              </div>

              <div className="stat-row">
                <span className="stat-label">Time Saved</span>
                <span>{vehicle.ai.time_saved} min</span>
              </div>

              <div className="stat-row">
                <span className="stat-label">Fuel Delta</span>
                <span>{(vehicle.baseline.fuel_est_l - vehicle.ai.fuel_est_l).toFixed(1)} L</span>
              </div>

              <div className="stat-row">
                <span className="stat-label">AI Distance</span>
                <span>{vehicle.ai.distance_km} km</span>
              </div>

              <div className="stat-row">
                <span className="stat-label">Baseline Distance</span>
                <span>{vehicle.baseline.distance_km} km</span>
              </div>

              <BaselineNarrative vehicle={vehicle} />
              <AiNarrative vehicle={vehicle} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
