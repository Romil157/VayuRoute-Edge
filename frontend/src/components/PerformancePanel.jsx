import React from 'react';

/**
 * PerformancePanel
 * Props:
 *   latency      - last decision loop latency in ms (from WebSocket)
 *   graphSource  - "osm" | "synthetic" (from WebSocket payload)
 *   modelSizeMb  - STGCN file size in MB (passed from App)
 *   weather      - { rain_intensity, wind_factor, is_storm } from /api/weather
 */
export default function PerformancePanel({ latency, graphSource, modelSizeMb, weather }) {
  const graphLabel  = graphSource === 'osm' ? 'OSM Graph Loaded' : 'Synthetic Fallback';
  const graphColor  = graphSource === 'osm' ? '#3fb950' : '#f0883e';

  const rainPct     = weather ? Math.round((weather.rain_intensity || 0) * 100) : null;
  const windKmh     = weather ? Math.round((weather.wind_factor || 0) * 60) : null;
  const stormLabel  = weather && weather.is_storm ? 'Storm Active' : 'No Storm';
  const stormColor  = weather && weather.is_storm ? '#f85149' : '#3fb950';

  return (
    <div className="glass-panel" style={{ borderLeft: '4px solid #a371f7' }}>
      <h2 style={{ borderBottom: 'none', marginBottom: '0.5rem' }}>Performance Telemetry</h2>

      <div className="stat-row">
        <span className="stat-label">Decision Time (ms):</span>
        <span style={{ color: '#c9d1d9', fontWeight: 600 }}>{latency} ms</span>
      </div>

      <div className="stat-row">
        <span className="stat-label">Execution Strategy:</span>
        <span style={{ color: '#c9d1d9', fontWeight: 600 }}>CPU-Only Edge</span>
      </div>

      <div className="stat-row">
        <span className="stat-label">Network Architecture:</span>
        <span
          className="status-badge status-offline"
          style={{ padding: '0.1rem 0.4rem', border: 'none' }}
        >
          DECENTRALIZED / OFFLINE
        </span>
      </div>

      <div className="stat-row">
        <span className="stat-label">Road Graph Source:</span>
        <span style={{ color: graphColor, fontWeight: 600 }}>{graphLabel}</span>
      </div>

      {modelSizeMb != null && (
        <div className="stat-row">
          <span className="stat-label">STGCN Model Size:</span>
          <span style={{ color: '#c9d1d9', fontWeight: 600 }}>{modelSizeMb} MB</span>
        </div>
      )}

      <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.6rem' }}>
        <span className="stat-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
          Live Weather — Mumbai
        </span>

        {weather ? (
          <>
            <div className="stat-row">
              <span className="stat-label">Rain Intensity:</span>
              <span style={{ color: '#58a6ff', fontWeight: 600 }}>
                {rainPct}% {weather.rain_intensity > 0.6 ? '(Heavy — flood boost active)' : ''}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Wind Speed:</span>
              <span style={{ color: '#c9d1d9', fontWeight: 600 }}>{windKmh} km/h</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Condition:</span>
              <span style={{ color: stormColor, fontWeight: 600 }}>{stormLabel}</span>
            </div>
          </>
        ) : (
          <div className="stat-row">
            <span style={{ color: '#8b949e' }}>Fetching weather...</span>
          </div>
        )}
      </div>
    </div>
  );
}
