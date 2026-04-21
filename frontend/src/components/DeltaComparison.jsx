import React from 'react';

export default function DeltaComparison({ data }) {
  if (!data?.vehicles?.length) {
    return null;
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
                <span>{pathDelta}</span>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
