import React, { useState } from 'react';
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

function App() {
  const { data, status } = useWebSocket('ws://localhost:8000/ws');
  const [routingMode, setRoutingMode] = useState('AI');

  const containerClass = data?.state?.frozen ? "dashboard-container screen-dim" : "dashboard-container";

  return (
    <div className={containerClass}>
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
            style={{ padding: '0.4rem', borderRadius: '4px', background: 'rgba(33, 38, 45, 0.8)', color: 'white', border: '1px solid #30363d' }}
          >
            <option value="BASELINE">Baseline Logistics Array</option>
            <option value="AI">VayuRoute Prediction Array</option>
          </select>
        </div>
      </header>

      <div className="main-layout">
        <section className="map-section">
          <LiveMap 
            data={data} 
            routingMode={routingMode} 
          />
        </section>

        <section className="panels-section" style={{ minWidth: '400px' }}>
          {data && <BusinessImpact metrics={data.state.business_metrics} />}
          {data && <RouteBuilder nodes={data.nodes} />}
          
          <ControlPanel />
          
          {data && (
            <>
              <CostFunctionPanel v1_ai={data.vehicles[0].ai} />
              <DeltaComparison data={data} routingMode={routingMode} />
              <RouteAlternatives v1_ai={data.vehicles[0].ai} />
              <DecisionIntelligence data={data} routingMode={routingMode} />
              <TimelineSlider currentHorizon={data.state.horizon} />
              <SystemLog logs={data.state.logs} />
              <PerformancePanel latency={data.latency_ms} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;
