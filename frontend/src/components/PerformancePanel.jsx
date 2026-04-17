import React from 'react';

export default function PerformancePanel({ latency }) {
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
        <span className="status-badge status-offline" style={{ padding: '0.1rem 0.4rem', border: 'none' }}>DECENTRALIZED / OFFLINE</span>
      </div>
    </div>
  );
}
