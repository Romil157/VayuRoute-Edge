import React, { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import LiveMap from './components/LiveMap';
import ControlPanel from './components/ControlPanel';
import DecisionIntelligence from './components/DecisionIntelligence';
import DeltaComparison from './components/DeltaComparison';
import TimelineSlider from './components/TimelineSlider';
import SystemLog from './components/SystemLog';
import PerformancePanel from './components/PerformancePanel';
import RouteBuilder from './components/RouteBuilder';
import BusinessImpact from './components/BusinessImpact';
import CostFunctionPanel from './components/CostFunctionPanel';
import RouteAlternatives from './components/RouteAlternatives';

// STGCN model size in MB (printed by the backend on startup, kept as constant here)
const MODEL_SIZE_MB = 0.02;

function StatusStrip({ graphSource, weather, latency, routingMode }) {
  const graphLabel  = graphSource === 'osm' ? 'OSM Graph Loaded' : 'Synthetic Fallback';
  const graphColor  = graphSource === 'osm' ? '#3fb950' : '#f0883e';

  const rainPct     = weather ? Math.round((weather.rain_intensity ?? 0) * 100) : 0;
  const isStorm     = weather?.is_storm ?? false;
  const weatherDesc = isStorm ? 'Storm' : rainPct > 60 ? 'Heavy Rain' : rainPct > 20 ? 'Rain' : 'Clear';
  const weatherColor = isStorm || rainPct > 60 ? '#f85149' : rainPct > 20 ? '#d29922' : '#3fb950';

  return (
    <div className="status-strip">
      <div className="strip-item">
        <span className="strip-dot" style={{ background: graphColor }} />
        <span style={{ color: graphColor }}>{graphLabel}</span>
      </div>

      <div className="strip-item">
        <span className="strip-dot" style={{ background: weatherColor }} />
        <span>Weather: </span>
        <span style={{ color: weatherColor }}>{weatherDesc} ({rainPct}%)</span>
      </div>

      <div className="strip-item">
        <span className="strip-dot" style={{ background: '#a371f7' }} />
        <span>Model: STGCN active</span>
        {latency != null && (
          <span style={{ color: '#c9d1d9' }}>, {latency} ms, {MODEL_SIZE_MB} MB</span>
        )}
      </div>

      <div className="strip-item">
        <span className="strip-dot" style={{ background: routingMode === 'AI' ? '#58a6ff' : '#8b949e' }} />
        <span style={{ color: routingMode === 'AI' ? '#58a6ff' : '#8b949e' }}>
          {routingMode === 'AI' ? 'AI Routing Active' : 'Baseline Mode'}
        </span>
      </div>
    </div>
  );
}

function App() {
  const { data, status } = useWebSocket('ws://localhost:8000/ws');
  const [routingMode, setRoutingMode] = useState('AI');
  const [weather, setWeather]         = useState(null);

  // Poll /api/weather every 60 seconds
  useEffect(() => {
    const fetchWeather = () => {
      fetch('http://localhost:8000/api/weather')
        .then((r) => r.json())
        .then((d) => setWeather(d))
        .catch(() => {});
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Sync weather from WebSocket payload on every tick (faster than polling)
  useEffect(() => {
    if (data && data.weather) {
      setWeather(data.weather);
    }
  }, [data]);

  const graphSource    = data?.graph_source ?? 'synthetic';
  const containerClass = data?.state?.frozen ? 'dashboard-container screen-dim' : 'dashboard-container';

  return (
    <div className={containerClass}>
      {/* Top navigation bar */}
      <header className="top-bar">
        <h1>VayuRoute Edge | Predictive Logistics Engine</h1>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <span className={`status-badge ${status === 'online' ? 'status-online' : 'status-offline'}`}>
            {status === 'online' ? 'System Online' : 'Status: Offline Mode Active'}
          </span>
          <span style={{ color: '#8b949e', fontWeight: 600 }}>
            Latency: {data ? data.latency_ms : '--'}ms
          </span>
          <select
            value={routingMode}
            onChange={(e) => setRoutingMode(e.target.value)}
            style={{
              padding: '0.4rem',
              borderRadius: '4px',
              background: 'rgba(33, 38, 45, 0.8)',
              color: 'white',
              border: '1px solid #30363d',
            }}
          >
            <option value="BASELINE">Baseline Logistics Array</option>
            <option value="AI">VayuRoute Prediction Array</option>
          </select>
        </div>
      </header>

      {/* Slim one-line system status strip */}
      <StatusStrip
        graphSource={graphSource}
        weather={weather}
        latency={data?.latency_ms}
        routingMode={routingMode}
      />

      <div className="main-layout">
        <section className="map-section">
          <LiveMap data={data} routingMode={routingMode} />
        </section>

        <section className="panels-section" style={{ minWidth: '400px' }}>
          {data && <BusinessImpact metrics={data.state.business_metrics} />}
          {data && <RouteBuilder nodes={data.nodes} />}

          <ControlPanel />

          {/* CostFunctionPanel renders live defaults even before first dispatch */}
          <CostFunctionPanel
            v1_ai={data?.vehicles?.[0]?.ai}
            weather={weather}
          />

          {data && (
            <>
              <DeltaComparison data={data} routingMode={routingMode} />
              <RouteAlternatives v1_ai={data.vehicles[0].ai} />
              <DecisionIntelligence data={data} routingMode={routingMode} />
              <TimelineSlider currentHorizon={data.state.horizon} />
              <SystemLog logs={data.state.logs} />
              <PerformancePanel
                latency={data.latency_ms}
                graphSource={graphSource}
                modelSizeMb={MODEL_SIZE_MB}
                weather={weather}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;
