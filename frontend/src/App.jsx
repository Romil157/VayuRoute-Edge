import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import BusinessImpact from './components/BusinessImpact';
import ControlPanel from './components/ControlPanel';
import CostFunctionPanel from './components/CostFunctionPanel';
import DecisionIntelligence from './components/DecisionIntelligence';
import DeltaComparison from './components/DeltaComparison';
import DemoSetupModal from './components/DemoSetupModal';
import LiveMap from './components/LiveMap';
import PerformancePanel from './components/PerformancePanel';
import RouteAlternatives from './components/RouteAlternatives';
import RouteBuilder from './components/RouteBuilder';
import SystemLog from './components/SystemLog';
import TimelineSlider from './components/TimelineSlider';
import VehicleTelemetryPanel from './components/VehicleTelemetryPanel';
import { useWebSocket } from './hooks/useWebSocket';
import { useMumbaiWeather } from './hooks/useMumbaiWeather';
import { apiUrl, wsUrl } from './lib/api';

const MODEL_SIZE_MB = 0.02;
const TruckSimulation3D = lazy(() => import('./components/TruckSimulation3D'));

function StatusStrip({ graphSource, weather, latency, metrics, liveWeather }) {
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
      <span>Sim Weather: {weatherLabel} ({rainPct}%)</span>
      {liveWeather && !liveWeather.loading && (
        <span>
          Live Mumbai: {liveWeather.condition} {liveWeather.temperature}°C
          {liveWeather.rain_mm > 0 ? ` | ${liveWeather.rain_mm}mm rain` : ''}
        </span>
      )}
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

// Speed multiplier per scenario
const SPEED_MULTIPLIERS = {
  normal: 1.0,
  rain: 0.7,
  heavy_rain: 0.5,
  flood: 0.4,
  low_fuel: 0.82,
};

// Scenario display labels
const SCENARIO_LABELS = {
  normal: 'Clear',
  rain: '🌧️ Rain',
  heavy_rain: '⛈️ Heavy Rain',
  flood: '🌊 Flood',
  low_fuel: '⛽ Low Fuel',
};

function App() {
  const { data, status } = useWebSocket(wsUrl('/ws'));
  const [routingMode, setRoutingMode] = useState('AI');
  const [viewMode, setViewMode] = useState('2D');
  const [weather, setWeather] = useState(null);
  const [demoOverlay, setDemoOverlay] = useState('');

  // ── Demo state machine ──
  const [demoState, setDemoState] = useState('setup'); // 'setup' | 'flyIn' | 'live'
  const [flyInDone, setFlyInDone] = useState(false);

  // ── Scenario state (drives speed + visuals) ──
  const [scenario, setScenario] = useState('normal');
  const speedMultiplier = SPEED_MULTIPLIERS[scenario] || 1.0;

  // ── Live weather from OpenWeatherMap ──
  const liveWeather = useMumbaiWeather();

  useEffect(() => {
    if (data?.weather) {
      setWeather(data.weather);
    }
  }, [data]);

  // ── Scenario selection handler (from setup modal) ──
  const handleScenarioSelect = useCallback(async (selectedScenario) => {
    setDemoState('flyIn');
    setFlyInDone(false);
    setScenario(selectedScenario === 'normal' ? 'normal' : selectedScenario);

    // Trigger the scenario on the backend
    try {
      await fetch(apiUrl(`/trigger/${selectedScenario}`), { method: 'POST' });
    } catch {
      // Backend might not be up yet — that's fine
    }
  }, []);

  // ── Fly-in completion callback ──
  const handleFlyInComplete = useCallback(() => {
    setFlyInDone(true);
  }, []);

  // ── Start simulation ──
  const handleStartSimulation = useCallback(() => {
    setDemoState('live');
  }, []);

  // ── Control panel: scenario change ──
  const handleScenarioChange = useCallback((newScenario) => {
    setScenario(newScenario);
  }, []);

  // ── Control panel: start demo sequence ──
  const handleStartDemo = useCallback(() => {
    // If we're in setup, go through flyIn first
    if (demoState === 'setup') {
      setDemoState('flyIn');
      setFlyInDone(false);
      // Auto-transition to live after fly-in
      setTimeout(() => setDemoState('live'), 4000);
    } else {
      // Already past setup, just ensure we're live
      setDemoState('live');
    }
  }, [demoState]);

  const vehicles = data?.vehicles ?? [];
  const metrics = data?.state?.business_metrics;

  // ── Scenario label: show active scenario + live weather ──
  const activeScenarioLabel = SCENARIO_LABELS[scenario] || 'Clear';
  const liveWeatherText = liveWeather && !liveWeather.loading && !liveWeather.error
    ? `${liveWeather.condition} ${liveWeather.temperature}°C`
    : '';
  const scenarioLabel = liveWeatherText
    ? `${activeScenarioLabel} · ${liveWeatherText}`
    : activeScenarioLabel;

  return (
    <div className={`dashboard-shell ${data?.state?.frozen ? 'screen-dim' : ''}`}>
      {/* ── Setup Modal ── */}
      {demoState === 'setup' && (
        <DemoSetupModal onSelect={handleScenarioSelect} />
      )}

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
        liveWeather={liveWeather}
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
                  <strong>{scenarioLabel}</strong>
                </div>
                <div>
                  <span className="hero-stat-label">Model</span>
                  <strong>STGCN + DQN</strong>
                </div>
              </div>
            </div>

            <div className="hero-stage">
              {demoOverlay && (
                <div className="demo-overlay">{demoOverlay}</div>
              )}

              {/* ── Start Simulation Button (visible after fly-in) ── */}
              {demoState === 'flyIn' && flyInDone && (
                <div className="start-sim-overlay">
                  <button className="start-sim-btn" onClick={handleStartSimulation}>
                    <span className="start-sim-icon">▶</span>
                    Start Simulation
                  </button>
                </div>
              )}

              {viewMode === '2D' ? (
                <LiveMap
                  data={data}
                  routingMode={routingMode}
                  demoState={demoState}
                  onFlyInComplete={handleFlyInComplete}
                  scenario={scenario}
                  speedMultiplier={speedMultiplier}
                />
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
          <ControlPanel
            onDemoOverlay={setDemoOverlay}
            onScenarioChange={handleScenarioChange}
            onStartDemo={handleStartDemo}
          />
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
