import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react';
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

const SCENARIO_LABELS = {
  normal: 'Clear',
  rain: 'Rain',
  heavy_rain: 'Heavy Rain',
  flood: 'Flood',
  low_fuel: 'Low Fuel',
};

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
          Live Mumbai: {liveWeather.condition} {liveWeather.temperature} C
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

function App() {
  const { data, status } = useWebSocket(wsUrl('/ws'));
  const [routingMode, setRoutingMode] = useState('AI');
  const [viewMode, setViewMode] = useState('2D');
  const [demoOverlay, setDemoOverlay] = useState('');
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [vehicleMapControls, setVehicleMapControls] = useState({});
  const [demoState, setDemoState] = useState('setup');
  const [flyInDone, setFlyInDone] = useState(false);
  const [scenario, setScenario] = useState('normal');

  const liveWeather = useMumbaiWeather();
  const weather = data?.weather ?? null;
  const vehicles = useMemo(() => data?.vehicles ?? [], [data?.vehicles]);
  const metrics = data?.state?.business_metrics;
  const vehicleControlState = useMemo(
    () =>
      Object.fromEntries(
        vehicles.map((vehicle) => [
          vehicle.id,
          vehicleMapControls[vehicle.id] || { paused: false, resetToken: 0 },
        ]),
      ),
    [vehicleMapControls, vehicles],
  );

  const handleScenarioSelect = useCallback(async (selectedScenario) => {
    setDemoState('flyIn');
    setFlyInDone(false);
    setScenario(selectedScenario === 'normal' ? 'normal' : selectedScenario);

    try {
      await fetch(apiUrl(`/trigger/${selectedScenario}`), { method: 'POST' });
    } catch {
      // Backend might not be up yet.
    }
  }, []);

  const handleFlyInComplete = useCallback(() => {
    setFlyInDone(true);
  }, []);

  const handleStartSimulation = useCallback(() => {
    setDemoState('live');
  }, []);

  const handleScenarioChange = useCallback((nextScenario) => {
    setScenario(nextScenario);
  }, []);

  const handleStartDemo = useCallback(() => {
    if (demoState === 'setup') {
      setDemoState('flyIn');
      setFlyInDone(false);
      window.setTimeout(() => setDemoState('live'), 4000);
      return;
    }

    setDemoState('live');
  }, [demoState]);

  const handleMapFullscreenChange = useCallback((nextFullscreen) => {
    setIsMapFullscreen(nextFullscreen);
  }, []);

  const handlePauseVehicle = useCallback((vehicleId) => {
    setVehicleMapControls((current) => ({
      ...current,
      [vehicleId]: {
        ...(current[vehicleId] || { resetToken: 0 }),
        paused: true,
      },
    }));
  }, []);

  const handleResumeVehicle = useCallback((vehicleId) => {
    setVehicleMapControls((current) => ({
      ...current,
      [vehicleId]: {
        ...(current[vehicleId] || { resetToken: 0 }),
        paused: false,
      },
    }));
  }, []);

  const handleResetVehicle = useCallback((vehicleId) => {
    setVehicleMapControls((current) => {
      const existing = current[vehicleId] || { paused: false, resetToken: 0 };
      return {
        ...current,
        [vehicleId]: {
          paused: false,
          resetToken: existing.resetToken + 1,
        },
      };
    });
  }, []);

  const activeScenarioLabel = SCENARIO_LABELS[scenario] || 'Clear';
  const liveWeatherText = liveWeather && !liveWeather.loading && !liveWeather.error
    ? `${liveWeather.condition} ${liveWeather.temperature} C`
    : '';
  const scenarioLabel = liveWeatherText
    ? `${activeScenarioLabel} | ${liveWeatherText}`
    : activeScenarioLabel;

  return (
    <div className={`dashboard-shell ${data?.state?.frozen ? 'screen-dim' : ''}`}>
      {demoState === 'setup' && <DemoSetupModal onSelect={handleScenarioSelect} />}

      <header className="top-bar">
        <div>
          <p className="eyebrow">Chief AI Architect Console</p>
          <h1>VayuRoute Edge Unified Logistics Intelligence</h1>
        </div>

        <div className="top-actions">
          <div className="toggle-group">
            <Toggle label="2D Map" active={viewMode === '2D'} onClick={() => setViewMode('2D')} />
            <Toggle
              label="3D Simulation"
              active={viewMode === '3D'}
              onClick={() => setViewMode('3D')}
            />
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

      <main className={isMapFullscreen ? 'app-shell map-focus' : 'app-shell'}>
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
              {demoOverlay && <div className="demo-overlay">{demoOverlay}</div>}

              {demoState === 'flyIn' && flyInDone && (
                <div className="start-sim-overlay">
                  <button className="start-sim-btn" type="button" onClick={handleStartSimulation}>
                    <span className="start-sim-icon">Start</span>
                    Simulation
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
                  onFullscreenChange={handleMapFullscreenChange}
                  vehicleControls={vehicleControlState}
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

        <aside className={isMapFullscreen ? 'sidebar sidebar-hidden' : 'sidebar'}>
          <RouteBuilder nodes={data?.nodes} vehicles={vehicles} />
          <BusinessImpact metrics={metrics} />
          <ControlPanel
            onDemoOverlay={setDemoOverlay}
            onScenarioChange={handleScenarioChange}
            onStartDemo={handleStartDemo}
            vehicles={vehicles}
            vehicleControls={vehicleControlState}
            onPauseVehicle={handlePauseVehicle}
            onResumeVehicle={handleResumeVehicle}
            onResetVehicle={handleResetVehicle}
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
