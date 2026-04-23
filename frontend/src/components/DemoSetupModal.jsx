import React from 'react';

const SCENARIOS = [
  {
    id: 'normal',
    label: 'Clear Skies',
    icon: '☀️',
    description: 'Standard conditions — baseline fleet routing with no disruptions.',
    gradient: 'linear-gradient(135deg, rgba(63,189,124,0.18), rgba(58,179,216,0.12))',
    border: 'rgba(63,189,124,0.35)',
  },
  {
    id: 'rain',
    label: 'Monsoon Rain',
    icon: '🌧️',
    description: 'Moderate rainfall across western suburbs — reduced visibility, wet roads.',
    gradient: 'linear-gradient(135deg, rgba(58,179,216,0.22), rgba(88,166,255,0.14))',
    border: 'rgba(58,179,216,0.4)',
  },
  {
    id: 'heavy_rain',
    label: 'Heavy Rain',
    icon: '⛈️',
    description: 'Intense downpour causing waterlogging in low-lying areas of Kurla and Dharavi.',
    gradient: 'linear-gradient(135deg, rgba(240,173,53,0.2), rgba(255,140,66,0.14))',
    border: 'rgba(240,173,53,0.4)',
  },
  {
    id: 'flood',
    label: 'Flood Alert',
    icon: '🌊',
    description: 'Critical flooding on coastal corridors — multiple road closures expected.',
    gradient: 'linear-gradient(135deg, rgba(239,100,97,0.2), rgba(255,100,97,0.12))',
    border: 'rgba(239,100,97,0.4)',
  },
];

export default function DemoSetupModal({ onSelect }) {
  return (
    <div className="demo-modal-backdrop">
      <div className="demo-modal-content">
        <div className="demo-modal-header">
          <p className="demo-modal-eyebrow">VayuRoute Edge</p>
          <h1 className="demo-modal-title">Logistics Intelligence Platform</h1>
          <p className="demo-modal-subtitle">
            Select a weather scenario to initialize the simulation environment.
          </p>
        </div>

        <div className="demo-modal-grid">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              className="scenario-card"
              onClick={() => onSelect(s.id)}
              style={{
                background: s.gradient,
                borderColor: s.border,
              }}
            >
              <span className="scenario-icon">{s.icon}</span>
              <strong className="scenario-label">{s.label}</strong>
              <span className="scenario-desc">{s.description}</span>
            </button>
          ))}
        </div>

        <p className="demo-modal-footer">
          AI-powered route optimization for Mumbai's monsoon logistics
        </p>
      </div>
    </div>
  );
}
