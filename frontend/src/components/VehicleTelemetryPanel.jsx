import React from 'react';

export default function VehicleTelemetryPanel({ vehicles = [] }) {
  if (!vehicles.length) {
    return null;
  }

  return (
    <div className="glass-panel telemetry-panel">
      <h2>Vehicle Tracking</h2>
      <div className="telemetry-grid">
        {vehicles.map((vehicle) => (
          <div key={vehicle.id} className="telemetry-card">
            <div className="telemetry-card-header">
              <div>
                <strong>{vehicle.id}</strong>
                <span>{vehicle.truck_profile?.truck_name ?? 'Truck profile pending'}</span>
              </div>
              <span
                className={`risk-pill ${
                  vehicle.telemetry.risk_status === 'High'
                    ? 'risk-high'
                    : vehicle.telemetry.risk_status === 'Medium'
                      ? 'risk-mid'
                      : 'risk-low'
                }`}
              >
                {vehicle.telemetry.risk_status}
              </span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Current Location</span>
              <span>{vehicle.telemetry.location_label}</span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Speed</span>
              <span>{vehicle.telemetry.speed_kmh} km/h</span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Fuel</span>
              <span>{vehicle.telemetry.fuel_percent}%</span>
            </div>

            <div className="stat-row">
              <span className="stat-label">ETA</span>
              <span>{vehicle.telemetry.eta_minutes} min</span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Risk Exposure</span>
              <span>{vehicle.telemetry.risk_exposure}%</span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Load Utilization</span>
              <span>
                {vehicle.truck_profile?.optimization_metrics?.box_utilization_pct ?? 0}%
              </span>
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${vehicle.telemetry.route_progress}%`, background: vehicle.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
