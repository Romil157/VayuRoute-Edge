import React, { useMemo, useState } from 'react';
import { apiUrl } from '../lib/api';

const BASE_URL = apiUrl('');
const VEHICLE_DEFAULTS = {
  V1: { start: 'A', end: 'J' },
  V2: { start: 'F', end: 'R' },
};

function emptyStop(defaultId) {
  return { id: defaultId, priority: 'Medium', deadline_mins: 60 };
}

export default function RouteBuilder({ nodes, vehicles }) {
  const [assignments, setAssignments] = useState([]);
  const [status, setStatus] = useState('');
  const [activeDispatch, setActiveDispatch] = useState('');

  const defaultAssignments = useMemo(() => {
    if (!nodes || !vehicles?.length) {
      return [];
    }

    return vehicles.map((vehicle) => {
      const defaults = VEHICLE_DEFAULTS[vehicle.id] || {};
      const start = defaults.start || vehicle.pos;
      let end = defaults.end || vehicle.target;

      if (end === start) {
        const allIds = Object.keys(nodes);
        end = allIds.find((id) => id !== start) || end;
      }

      return {
        vehicle_id: vehicle.id,
        start,
        end,
        fuel: vehicle.fuel,
        stops: vehicle.stops?.length ? vehicle.stops : [],
      };
    });
  }, [nodes, vehicles]);

  const effectiveAssignments = assignments.length ? assignments : defaultAssignments;

  if (!nodes || !vehicles) {
    return null;
  }

  const locationOptions = Object.entries(nodes).map(([id, node]) => ({
    id,
    name: node.name,
  }));
  const defaultStopId = locationOptions[0]?.id ?? 'A';

  const withAssignments = (updater) => {
    setAssignments((current) => updater(current.length ? current : defaultAssignments));
  };

  const updateAssignment = (vehicleId, patch) => {
    withAssignments((current) =>
      current.map((assignment) =>
        assignment.vehicle_id === vehicleId ? { ...assignment, ...patch } : assignment,
      ),
    );
  };

  const updateStop = (vehicleId, stopIndex, field, value) => {
    withAssignments((current) =>
      current.map((assignment) => {
        if (assignment.vehicle_id !== vehicleId) {
          return assignment;
        }

        const nextStops = assignment.stops.map((stop, index) =>
          index === stopIndex
            ? {
                ...stop,
                [field]: field === 'deadline_mins' ? Number(value) : value,
              }
            : stop,
        );

        return { ...assignment, stops: nextStops };
      }),
    );
  };

  const addStop = (vehicleId) => {
    withAssignments((current) =>
      current.map((assignment) =>
        assignment.vehicle_id === vehicleId
          ? { ...assignment, stops: [...assignment.stops, emptyStop(defaultStopId)] }
          : assignment,
      ),
    );
  };

  const removeStop = (vehicleId, stopIndex) => {
    withAssignments((current) =>
      current.map((assignment) =>
        assignment.vehicle_id === vehicleId
          ? {
              ...assignment,
              stops: assignment.stops.filter((_, index) => index !== stopIndex),
            }
          : assignment,
      ),
    );
  };

  const dispatchAssignments = async (nextAssignments, label) => {
    setActiveDispatch(label);
    setStatus(`Dispatching ${label.toLowerCase()}...`);

    try {
      const response = await fetch(`${BASE_URL}/api/routes/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: nextAssignments }),
      });

      if (!response.ok) {
        setStatus(`Dispatch failed (${response.status})`);
        return;
      }

      setStatus(`${label} updated`);
    } catch (error) {
      setStatus(`Dispatch failed: ${error.message}`);
    } finally {
      setActiveDispatch('');
    }
  };

  const submitRoutes = async () => {
    await dispatchAssignments(effectiveAssignments, 'Fleet dispatch');
  };

  const dispatchVehicle = async (vehicleId) => {
    const assignment = effectiveAssignments.find((entry) => entry.vehicle_id === vehicleId);
    if (!assignment) {
      setStatus(`No assignment found for ${vehicleId}`);
      return;
    }

    await dispatchAssignments([assignment], `Dispatch ${vehicleId}`);
  };

  return (
    <div className="glass-panel">
      <h2>Fleet Dispatch Console</h2>
      <p className="panel-copy">
        Configure each truck independently, then push one synchronized dispatch to the backend.
      </p>

      {status && <div className="inline-status">{status}</div>}

      <div className="route-builder-grid">
        {effectiveAssignments.map((assignment) => (
          <div key={assignment.vehicle_id} className="subpanel">
            <div className="subpanel-header">
              <strong>{assignment.vehicle_id}</strong>
              <span>
                {vehicles.find((vehicle) => vehicle.id === assignment.vehicle_id)?.truck_profile
                  ?.truck_name ?? 'Awaiting Cloudtrack profile'}
              </span>
            </div>

            <label className="field-label">
              Start
              <select
                value={assignment.start}
                onChange={(event) =>
                  updateAssignment(assignment.vehicle_id, { start: event.target.value })
                }
              >
                {locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-label">
              Destination
              <select
                value={assignment.end}
                onChange={(event) =>
                  updateAssignment(assignment.vehicle_id, { end: event.target.value })
                }
              >
                {locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-label">
              Starting Fuel (%)
              <input
                type="number"
                min="0"
                max="100"
                value={assignment.fuel}
                onChange={(event) =>
                  updateAssignment(assignment.vehicle_id, { fuel: Number(event.target.value) })
                }
              />
            </label>

            <div className="stops-header">
              <span>Stops ({assignment.stops.length})</span>
              <button type="button" onClick={() => addStop(assignment.vehicle_id)}>
                Add Stop
              </button>
            </div>

            <div className="stops-stack">
              {assignment.stops.map((stop, index) => (
                <div key={`${assignment.vehicle_id}-stop-${index}`} className="stop-card">
                  <div className="stop-card-row">
                    <select
                      value={stop.id}
                      onChange={(event) =>
                        updateStop(assignment.vehicle_id, index, 'id', event.target.value)
                      }
                    >
                      {locationOptions.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => removeStop(assignment.vehicle_id, index)}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="stop-card-row">
                    <select
                      value={stop.priority}
                      onChange={(event) =>
                        updateStop(assignment.vehicle_id, index, 'priority', event.target.value)
                      }
                    >
                      <option value="High">High Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="Low">Low Priority</option>
                    </select>

                    <select
                      value={stop.deadline_mins}
                      onChange={(event) =>
                        updateStop(
                          assignment.vehicle_id,
                          index,
                          'deadline_mins',
                          event.target.value,
                        )
                      }
                    >
                      <option value="30">SLA +30m</option>
                      <option value="45">SLA +45m</option>
                      <option value="60">SLA +60m</option>
                      <option value="90">SLA +90m</option>
                      <option value="120">SLA +120m</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="panel-actions subpanel-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => dispatchVehicle(assignment.vehicle_id)}
                disabled={Boolean(activeDispatch)}
              >
                {activeDispatch === `Dispatch ${assignment.vehicle_id}`
                  ? `Dispatching ${assignment.vehicle_id}...`
                  : `Dispatch ${assignment.vehicle_id}`}
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        className="btn-primary"
        type="button"
        onClick={submitRoutes}
        disabled={Boolean(activeDispatch)}
      >
        Dispatch All Vehicles
      </button>
    </div>
  );
}
