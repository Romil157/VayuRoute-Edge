import React, { useState } from 'react';
import { apiUrl } from '../lib/api';

const BASE = apiUrl('');

export default function ControlPanel({
  onDemoOverlay,
  onScenarioChange,
  onStartDemo,
  vehicles = [],
  vehicleControls = {},
  onPauseVehicle,
  onResumeVehicle,
  onResetVehicle,
}) {
  const [status, setStatus] = useState('');
  const [demoRunning, setDemoRunning] = useState(false);

  const triggerEvent = async (type) => {
    setStatus(`Sending: ${type}...`);
    try {
      const res = await fetch(`${BASE}/trigger/${type}`, { method: 'POST' });
      if (!res.ok) {
        const text = await res.text();
        setStatus(`Error ${res.status}: ${text}`);
      } else {
        setStatus(`OK: ${type}`);
      }
    } catch (error) {
      setStatus(`Failed to reach backend: ${error.message}`);
    }
  };

  const setTimeline = async (value) => {
    try {
      const res = await fetch(`${BASE}/timeline/${value}`, { method: 'POST' });
      if (!res.ok) {
        setStatus(`Timeline error ${res.status}`);
      }
    } catch (error) {
      setStatus(`Timeline fetch failed: ${error.message}`);
    }
  };

  const overlay = (message) => {
    if (onDemoOverlay) {
      onDemoOverlay(message);
    }
  };

  const handleReset = async () => {
    await triggerEvent('normal');
    if (onScenarioChange) {
      onScenarioChange('reset');
    }
    overlay('');
    setTimeout(() => {
      if (onScenarioChange) {
        onScenarioChange('normal');
      }
    }, 100);
  };

  const handleRain = async () => {
    await triggerEvent('rain');
    if (onScenarioChange) {
      onScenarioChange('rain');
    }
    overlay('Rain detected. Truck speeds reduced by 30%.');
    setTimeout(() => overlay(''), 4000);
  };

  const handleFlood = async () => {
    await triggerEvent('flood');
    await setTimeline(45);
    if (onScenarioChange) {
      onScenarioChange('flood');
    }
    overlay('Flood alert. Routes compromised, rerouting fleet.');
    setTimeout(() => overlay(''), 5000);
  };

  const handleLowFuel = async () => {
    await triggerEvent('low_fuel');
    if (onScenarioChange) {
      onScenarioChange('low_fuel');
    }
    overlay('Fuel reserve critical. Adjusting path selection.');
    setTimeout(() => overlay(''), 4000);
  };

  const runTurboDemo = async () => {
    if (demoRunning) {
      return;
    }

    setDemoRunning(true);
    setStatus('Demo sequence running...');

    if (onStartDemo) {
      onStartDemo();
    }

    overlay('Initializing fleet under normal conditions...');
    await triggerEvent('normal');
    if (onScenarioChange) {
      onScenarioChange('normal');
    }

    setTimeout(() => {
      overlay('Predicting disruption. Rain incoming...');
      triggerEvent('rain');
      if (onScenarioChange) {
        onScenarioChange('rain');
      }
    }, 6000);

    setTimeout(() => {
      overlay('Flood detected. Recomputing optimal routes...');
      triggerEvent('flood');
      setTimeline(45);
      if (onScenarioChange) {
        onScenarioChange('flood');
      }
    }, 12000);

    setTimeout(() => {
      overlay('Fuel reserve critical. Adjusting path selection...');
      triggerEvent('low_fuel');
      if (onScenarioChange) {
        onScenarioChange('low_fuel');
      }
    }, 18000);

    setTimeout(() => {
      overlay('Recovery. Returning to nominal operations.');
      triggerEvent('normal');
      setTimeline(0);
      if (onScenarioChange) {
        onScenarioChange('normal');
      }
    }, 24000);

    setTimeout(() => {
      overlay('');
      setStatus('Demo sequence complete.');
      setDemoRunning(false);
    }, 28000);
  };

  const statusClassName =
    status.startsWith('Error') || status.startsWith('Failed')
      ? 'control-status control-status-error'
      : 'control-status';

  return (
    <div className="glass-panel">
      <h2>Simulation Control</h2>

      {status && <div className={statusClassName}>{status}</div>}

      <div className="panel-actions">
        <button className="btn-primary" type="button" onClick={handleReset}>
          Reset Scenario
        </button>
        <button type="button" onClick={handleRain}>
          Trigger Rain Module
        </button>
        <button className="btn-danger" type="button" onClick={handleFlood}>
          Inject Flood Parameters
        </button>
        <button type="button" onClick={handleLowFuel}>
          Drop Fuel Telemetry
        </button>

        <div className="panel-divider" />

        <button
          className="btn-highlight"
          type="button"
          onClick={runTurboDemo}
          disabled={demoRunning}
        >
          {demoRunning ? 'Demo Running...' : 'Start Demo Sequence'}
        </button>
      </div>

      {vehicles.length > 0 && (
        <div className="vehicle-controls-section">
          <div className="panel-divider" />
          <p className="panel-copy vehicle-controls-copy">
            Vehicle controls below affect only the 2D map marker behavior.
          </p>

          <div className="vehicle-control-grid">
            {vehicles.map((vehicle) => {
              const controlState = vehicleControls[vehicle.id] || { paused: false };

              return (
                <div key={vehicle.id} className="vehicle-control-card">
                  <div className="vehicle-control-header">
                    <strong>{vehicle.id}</strong>
                    <span>{controlState.paused ? 'Paused on map' : 'Live on map'}</span>
                  </div>

                  <div className="vehicle-control-actions">
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() => onPauseVehicle?.(vehicle.id)}
                      disabled={controlState.paused}
                    >
                      Pause
                    </button>
                    <button
                      type="button"
                      onClick={() => onResumeVehicle?.(vehicle.id)}
                      disabled={!controlState.paused}
                    >
                      Resume
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => onResetVehicle?.(vehicle.id)}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
