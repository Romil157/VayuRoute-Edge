import React, { useState } from 'react';
import { apiUrl } from '../lib/api';

const BASE = apiUrl('');

export default function ControlPanel({ onDemoOverlay, onScenarioChange, onStartDemo }) {
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

  const overlay = (msg) => {
    if (onDemoOverlay) onDemoOverlay(msg);
  };

  // ── Reset: snap vehicles to start, clear scenario, pause ──
  const handleReset = async () => {
    await triggerEvent('normal');
    if (onScenarioChange) onScenarioChange('reset'); // 'reset' clears positions in LiveMap
    overlay('');
    // After clearing, set back to normal for display purposes
    setTimeout(() => { if (onScenarioChange) onScenarioChange('normal'); }, 100);
  };

  // ── Rain: reduce truck speed, update scenario text ──
  const handleRain = async () => {
    await triggerEvent('rain');
    if (onScenarioChange) onScenarioChange('rain');
    overlay('🌧️ Rain detected — truck speeds reduced by 30%');
    setTimeout(() => overlay(''), 4000);
  };

  // ── Flood: further reduce speed, turn routes red, show warning ──
  const handleFlood = async () => {
    await triggerEvent('flood');
    setTimeline(45);
    if (onScenarioChange) onScenarioChange('flood');
    overlay('🌊 FLOOD ALERT — routes compromised, rerouting fleet');
    setTimeout(() => overlay(''), 5000);
  };

  // ── Low fuel ──
  const handleLowFuel = async () => {
    await triggerEvent('low_fuel');
    if (onScenarioChange) onScenarioChange('low_fuel');
    overlay('⛽ Fuel reserve critical — adjusting path selection');
    setTimeout(() => overlay(''), 4000);
  };

  // ── Start Demo Sequence: triggers flyTo + starts vehicle movement ──
  const runTurboDemo = async () => {
    if (demoRunning) return;
    setDemoRunning(true);
    setStatus('Demo sequence running...');

    // Step 1: Trigger the flyTo + start via the state machine
    if (onStartDemo) onStartDemo();

    overlay('Initializing fleet under normal conditions...');
    await triggerEvent('normal');
    if (onScenarioChange) onScenarioChange('normal');

    setTimeout(() => {
      overlay('🌧️ Predicting disruption — rain incoming...');
      triggerEvent('rain');
      if (onScenarioChange) onScenarioChange('rain');
    }, 6000);

    setTimeout(() => {
      overlay('🌊 Flood detected — recomputing optimal routes...');
      triggerEvent('flood');
      setTimeline(45);
      if (onScenarioChange) onScenarioChange('flood');
    }, 12000);

    setTimeout(() => {
      overlay('⛽ Fuel reserve critical — adjusting path selection...');
      triggerEvent('low_fuel');
      if (onScenarioChange) onScenarioChange('low_fuel');
    }, 18000);

    setTimeout(() => {
      overlay('✅ Recovery — returning to nominal operations');
      triggerEvent('normal');
      setTimeline(0);
      if (onScenarioChange) onScenarioChange('normal');
    }, 24000);

    setTimeout(() => {
      overlay('');
      setStatus('Demo sequence complete.');
      setDemoRunning(false);
    }, 28000);
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
        <button className="btn-primary" onClick={handleReset}>
          Reset Scenario
        </button>
        <button onClick={handleRain}>
          Trigger Rain Module
        </button>
        <button className="btn-danger" onClick={handleFlood}>
          Inject Flood Parameters
        </button>
        <button onClick={handleLowFuel}>
          Drop Fuel Telemetry
        </button>

        <hr style={{ borderColor: 'rgba(48,54,61,0.5)', margin: '0.4rem 0' }} />

        <button
          onClick={runTurboDemo}
          disabled={demoRunning}
          style={{
            backgroundColor: demoRunning ? 'rgba(255,171,0,0.08)' : 'rgba(255,171,0,0.2)',
            color: '#ffab00',
            borderColor: '#ffab00',
            fontSize: '1rem',
            padding: '1rem',
            opacity: demoRunning ? 0.6 : 1,
          }}
        >
          {demoRunning ? 'Demo Running...' : '▶ Start Demo Sequence'}
        </button>
      </div>
    </div>
  );
}
