import React, { Suspense, lazy, useEffect, useState } from 'react';
import BusinessImpact from './components/BusinessImpact';
import ControlPanel from './components/ControlPanel';
import CostFunctionPanel from './components/CostFunctionPanel';
import DecisionIntelligence from './components/DecisionIntelligence';
import DeltaComparison from './components/DeltaComparison';
import LiveMap from './components/LiveMap';
import PerformancePanel from './components/PerformancePanel';
import RouteAlternatives from './components/RouteAlternatives';
import RouteBuilder from './components/RouteBuilder';
import SystemLog from './components/SystemLog';
import TimelineSlider from './components/TimelineSlider';
import VehicleTelemetryPanel from './components/VehicleTelemetryPanel';
import { useWebSocket } from './hooks/useWebSocket';
import { wsUrl } from './lib/api';

const MODEL_SIZE_MB = 0.02;
const TruckSimulation3D = lazy(() => import('./components/TruckSimulation3D'));

function StatusStrip({ graphSource, weather, latency, metrics }) {
  const rainPct = Math.round((weather?.rain_intensity ?? 0) * 100);
  const weatherLabel = weather?.is_storm
    ? 'Storm'
    : rainPct >= 60
      ? 'Heavy Rain'
      : rainPct >= 20
        ? 'Rain'
        : 'Clear';

  return (
    <div className="status-strip">
      <span>{graphSource === 'osm' ? 'OSM graph active' : 'Synthetic graph fallback'}</span>
      <span>Weather: {weatherLabel} ({rainPct}%)</span>
      <span>Latency: {latency ?? '--'} ms</span>
      <span>Time saved: {metrics?.time_saved_min ?? 0} min</span>
      <span>Fuel saved: {metrics?.fuel_saved_l ?? 0} L</span>
    </div>
  );
}

function Toggle({ label, active, onClick }) {
  return (
    <button
      type="button"
      className={active ? 'toggle-chip active' : 'toggle-chip'}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function App() {
  const { data, status } = useWebSocket(wsUrl('/ws'));
  const [routingMode, setRoutingMode] = useState('AI');
  const [viewMode, setViewMode] = useState('2D');
  const [weather, setWeather] = useState(null);
  const [demoOverlay, setDemoOverlay] = useState('');

  useEffect(() => {
    if (data?.weather) {
      setWeather(data.weather);
    }
  }, [data]);

  const vehicles = data?.vehicles ?? [];
  const metrics = data?.state?.business_metrics;

  return (
    <div className={`dashboard-shell ${data?.state?.frozen ? 'screen-dim' : ''}`}>
      <header className="top-bar">
        <div>
          <p className="eyebrow">Chief AI Architect Console</p>
          <h1>VayuRoute Edge Unified Logistics Intelligence</h1>
        </div>

        <div className="top-actions">
          <div className="toggle-group">
            <Toggle label="2D Map" active={viewMode === '2D'} onClick={() => setViewMode('2D')} />
            <Toggle label="3D Simulation" active={viewMode === '3D'} onClick={() => setViewMode('3D')} />
          </div>

          <div className="toggle-group">
            <Toggle label="AI View" active={routingMode === 'AI'} onClick={() => setRoutingMode('AI')} />
            <Toggle
              label="Baseline View"
              active={routingMode === 'BASELINE'}
              onClick={() => setRoutingMode('BASELINE')}
            />
          </div>

          <span className={`status-badge ${status === 'online' ? 'status-online' : 'status-offline'}`}>
            {status === 'online' ? 'Realtime Stream Online' : 'Waiting for Backend'}
          </span>
        </div>
      </header>

      <StatusStrip
        graphSource={data?.graph_source}
        weather={weather}
        latency={data?.latency_ms}
        metrics={metrics}
      />

      <main className="app-shell">
        <section className="visual-column">
          <div className="hero-panel">
            <div className="hero-toolbar">
              <div>
                <h2>{viewMode === '2D' ? 'Mumbai Route Intelligence' : '3D Truck Movement'}</h2>
                <p className="panel-copy">
                  {viewMode === '2D'
                    ? 'Risk heatmaps, live route divergence, and current fleet position.'
                    : 'Truck movement synchronized to backend telemetry and Cloudtrack load profiles.'}
                </p>
              </div>
              <div className="hero-stats">
                <div>
                  <span className="hero-stat-label">Active Vehicles</span>
                  <strong>{vehicles.length}</strong>
                </div>
                <div>
                  <span className="hero-stat-label">Scenario</span>
                  <strong>{data?.state?.event ?? 'normal'}</strong>
                </div>
                <div>
                  <span className="hero-stat-label">Model</span>
                  <strong>STGCN + RiskAwareRouter</strong>
                </div>
              </div>
            </div>

            <div className="hero-stage">
              {demoOverlay && (
                <div className="demo-overlay">{demoOverlay}</div>
              )}
              {viewMode === '2D' ? (
                <LiveMap data={data} routingMode={routingMode} />
              ) : (
                <Suspense fallback={<div className="empty-state">Loading 3D simulation...</div>}>
                  <TruckSimulation3D data={data} routingMode={routingMode} />
                </Suspense>
              )}
            </div>
          </div>

          <VehicleTelemetryPanel vehicles={vehicles} />
        </section>

        <aside className="sidebar">
          <RouteBuilder nodes={data?.nodes} vehicles={vehicles} />
          <BusinessImpact metrics={metrics} />
          <ControlPanel onDemoOverlay={setDemoOverlay} />
          <DeltaComparison data={data} routingMode={routingMode} />
          <DecisionIntelligence data={data} routingMode={routingMode} />
          <CostFunctionPanel v1_ai={vehicles[0]?.ai} weather={weather} />
          <RouteAlternatives v1_ai={vehicles[0]?.ai} />
          <TimelineSlider currentHorizon={data?.state?.horizon ?? 45} />
          <PerformancePanel
            latency={data?.latency_ms}
            graphSource={data?.graph_source}
            modelSizeMb={MODEL_SIZE_MB}
            weather={weather}
          />
          <SystemLog logs={data?.state?.logs ?? []} />
        </aside>
      </main>
    </div>
  );
}

export default App;
