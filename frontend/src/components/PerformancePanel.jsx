import React from 'react';

export default function PerformancePanel({ latency, graphSource, modelSizeMb, weather }) {
  const rainPct = Math.round((weather?.rain_intensity ?? 0) * 100);
  const windKmh = Math.round((weather?.wind_factor ?? 0) * 60);

  const hasLiveRain =
    weather?.rain_intensity !== undefined && weather.rain_intensity > 0;
  const weatherSource = hasLiveRain ? 'Open-Meteo Live' : 'Open-Meteo cached';

  return (
    <div className="glass-panel">
      <h2>Platform Telemetry</h2>
      <div className="stat-row">
        <span className="stat-label">Decision Latency</span>
        <span>{latency ?? '--'} ms</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Road Graph</span>
        <span>{graphSource === 'osm' ? 'Mumbai OSM cache' : 'Synthetic fallback'}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">AI Stack</span>
        <span>STGCN + RiskAwareRouter</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Model Footprint</span>
        <span>{modelSizeMb} MB</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Weather</span>
        <span>
          {rainPct}% rain / {windKmh} km/h wind
        </span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Weather Source</span>
        <span>{weatherSource}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Runtime</span>
        <span>CPU-only realtime loop</span>
      </div>
    </div>
  );
}
