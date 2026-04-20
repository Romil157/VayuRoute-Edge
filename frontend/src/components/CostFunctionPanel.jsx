import React from 'react';

/**
 * CostFunctionPanel — formerly "DQN Cost Function Diagnostics"
 * Now correctly labelled as "Risk-Aware Router Diagnostics".
 *
 * Shows live values from the first WebSocket tick without requiring
 * any manual dispatch. Falls back to safe zero-values if data is absent.
 *
 * Props:
 *   v1_ai   - the ai object from vehicles[0] (from WebSocket payload)
 *   weather - live weather dict { rain_intensity, wind_factor, is_storm }
 */
export default function CostFunctionPanel({ v1_ai, weather }) {
  // Show safe defaults before the first WebSocket tick
  const cf         = v1_ai?.cost_function  ?? {};
  const confidence = v1_ai?.confidence     ?? 0;
  const maxRisk    = v1_ai?.max_risk       ?? 0;
  const travelTime = cf.Time               ?? 0;
  const riskScore  = cf.Risk               ?? maxRisk;
  const rainPct    = weather
    ? Math.round((weather.rain_intensity ?? 0) * 100)
    : 0;
  const weatherLabel = weather?.is_storm
    ? 'Storm Active'
    : rainPct > 60
    ? 'Heavy Rain'
    : rainPct > 20
    ? 'Light Rain'
    : 'Clear';
  const weatherColor = weather?.is_storm || rainPct > 60
    ? '#f85149'
    : rainPct > 20
    ? '#d29922'
    : '#3fb950';

  return (
    <div className="glass-panel">
      <h2>Risk-Aware Router Diagnostics</h2>

      {/* Global score — route confidence */}
      <div style={{
        padding: '0.8rem',
        background: 'rgba(33, 38, 45, 0.4)',
        borderRadius: '6px',
        textAlign: 'center',
        marginBottom: '1rem',
        border: '1px solid #58a6ff',
      }}>
        <span style={{
          display: 'block',
          fontSize: '0.8rem',
          color: '#8b949e',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          Global Algorithmic Score
        </span>
        <span style={{ fontSize: '1.6rem', color: '#58a6ff', fontWeight: 'bold' }}>
          {confidence}
        </span>
        <span style={{ fontSize: '0.75rem', color: '#8b949e', marginLeft: '0.3rem' }}>
          / 100 confidence
        </span>
      </div>

      <div className="stat-row">
        <span className="stat-label">Temporal Distance (min):</span>
        <span style={{ color: '#c9d1d9', fontWeight: 600 }}>{travelTime}</span>
      </div>

      <div className="stat-row">
        <span className="stat-label">Risk Score:</span>
        <span
          style={{
            color: riskScore > 50 ? '#f85149' : riskScore > 20 ? '#d29922' : '#3fb950',
            fontWeight: 600,
          }}
        >
          {riskScore}%
        </span>
      </div>

      <div className="stat-row">
        <span className="stat-label">Estimated Fuel Loss (L):</span>
        <span style={{ color: '#c9d1d9', fontWeight: 600 }}>{cf.Fuel ?? 0}</span>
      </div>

      <div className="stat-row">
        <span className="stat-label">SLA / Priority Penalty:</span>
        <span
          style={{ color: (cf.Priority ?? 0) > 0 ? '#ff7b72' : '#3fb950', fontWeight: 600 }}
        >
          {cf.Priority ?? 0}
        </span>
      </div>

      <div className="stat-row">
        <span className="stat-label">Weather Status:</span>
        <span style={{ color: weatherColor, fontWeight: 600 }}>
          {weatherLabel} ({rainPct}%)
        </span>
      </div>

      <div style={{
        marginTop: '1rem',
        fontSize: '0.75rem',
        color: '#8b949e',
        textAlign: 'center',
      }}>
        cost = 0.50 * time + 0.35 * risk + 0.15 * fuel
      </div>
    </div>
  );
}
