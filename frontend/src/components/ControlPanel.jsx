import React, { useState } from 'react';

const BASE = 'http://localhost:8000';

export default function ControlPanel() {
  const [status, setStatus] = useState('');

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
    } catch (e) {
      setStatus(`Failed to reach backend: ${e.message}`);
    }
  };

  const setTimeline = async (val) => {
    try {
      const res = await fetch(`${BASE}/timeline/${val}`, { method: 'POST' });
      if (!res.ok) setStatus(`Timeline error ${res.status}`);
    } catch (e) {
      setStatus(`Timeline fetch failed: ${e.message}`);
    }
  };

  const runTurboDemo = async () => {
    setStatus('Turbo demo starting...');
    await triggerEvent('normal');
    setTimeout(() => triggerEvent('rain'), 3000);
    setTimeout(() => {
      triggerEvent('flood');
      setTimeline(45);
    }, 7000);
    setTimeout(() => {
      triggerEvent('low_fuel');
    }, 13000);
    setTimeout(() => {
      triggerEvent('normal');
      setTimeline(0);
      setStatus('Turbo demo complete.');
    }, 20000);
  };

  return (
    <div className="glass-panel">
      <h2>Simulation Control</h2>

      {status && (
        <div style={{
          marginBottom: '0.6rem',
          padding: '0.4rem 0.6rem',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '4px',
          fontSize: '0.75rem',
          color: status.startsWith('Error') || status.startsWith('Failed') ? '#ff6b6b' : '#00e5ff'
        }}>
          {status}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <button className="btn-primary" onClick={() => triggerEvent('normal')}>
          Initialize / Clear Events
        </button>
        <button onClick={() => triggerEvent('rain')}>
          Trigger Rain Module
        </button>
        <button className="btn-danger" onClick={() => triggerEvent('flood')}>
          Inject Flood Parameters
        </button>
        <button onClick={() => triggerEvent('low_fuel')}>
          Drop Fuel Telemetry
        </button>

        <hr style={{ borderColor: 'rgba(48,54,61,0.5)', margin: '0.4rem 0' }} />

        <button
          onClick={runTurboDemo}
          style={{
            backgroundColor: 'rgba(255,171,0,0.2)',
            color: '#ffab00',
            borderColor: '#ffab00',
            fontSize: '1rem',
            padding: '1rem'
          }}
        >
          START 60s TURBO DEMO
        </button>
      </div>
    </div>
  );
}