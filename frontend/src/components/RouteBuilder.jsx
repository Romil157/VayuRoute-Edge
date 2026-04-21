import React, { useEffect, useState } from 'react';
import { apiUrl } from '../lib/api';

const BASE_URL = apiUrl('');

function emptyStop(defaultId) {
  return { id: defaultId, priority: 'Medium', deadline_mins: 60 };
}

export default function RouteBuilder({ nodes, vehicles }) {
  const [assignments, setAssignments] = useState([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!nodes || !vehicles || assignments.length > 0) {
      return;
    }

    setAssignments(
      vehicles.map((vehicle) => ({
        vehicle_id: vehicle.id,
        start: vehicle.pos,
        end: vehicle.target,
        fuel: vehicle.fuel,
        stops: vehicle.stops?.length ? vehicle.stops : [],
      })),
    );
  }, [assignments.length, nodes, vehicles]);

  if (!nodes || !vehicles) {
    return null;
  }

  const locationOptions = Object.entries(nodes).map(([id, node]) => ({
    id,
    name: node.name,
  }));

  const defaultStopId = locationOptions[0]?.id ?? 'A';

  const updateAssignment = (vehicleId, patch) => {
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.vehicle_id === vehicleId ? { ...assignment, ...patch } : assignment,
      ),
    );
  };

  const updateStop = (vehicleId, stopIndex, field, value) => {
    setAssignments((current) =>
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
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.vehicle_id === vehicleId
          ? { ...assignment, stops: [...assignment.stops, emptyStop(defaultStopId)] }
          : assignment,
      ),
    );
  };

  const removeStop = (vehicleId, stopIndex) => {
    setAssignments((current) =>
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

  const submitRoutes = async () => {
    setStatus('Dispatching fleet...');
    try {
      const response = await fetch(`${BASE_URL}/api/routes/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments }),
      });
      if (!response.ok) {
        setStatus(`Dispatch failed (${response.status})`);
        return;
      }
      setStatus('Fleet dispatch updated');
    } catch (error) {
      setStatus(`Dispatch failed: ${error.message}`);
    }
  };

  return (
    <div className="glass-panel">
      <h2>Fleet Dispatch Console</h2>
      <p className="panel-copy">
        Configure each truck independently, then push one synchronized dispatch to the backend.
      </p>

      {status && <div className="inline-status">{status}</div>}

      <div className="route-builder-grid">
        {assignments.map((assignment) => (
          <div key={assignment.vehicle_id} className="subpanel">
            <div className="subpanel-header">
              <strong>{assignment.vehicle_id}</strong>
              <span>{vehicles.find((vehicle) => vehicle.id === assignment.vehicle_id)?.truck_profile?.truck_name ?? 'Awaiting Cloudtrack profile'}</span>
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
          </div>
        ))}
      </div>

      <button className="btn-primary" type="button" onClick={submitRoutes}>
        Dispatch All Vehicles
      </button>
    </div>
  );
}
