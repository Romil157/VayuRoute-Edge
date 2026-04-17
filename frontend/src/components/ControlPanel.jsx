import React from 'react';

export default function ControlPanel() {
  const triggerEvent = async (type) => {
    try {
      await fetch(`http://localhost:8000/trigger/${type}`, { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  };

  const setTimeline = async (val) => {
    try {
      await fetch(`http://localhost:8000/timeline/${val}`, { method: 'POST' });
    } catch (e) {}
  };

  const runTurboDemo = async () => {
    // 1. Set a complex route
    const complexRoute = {
      start: "A",
      end: "R",
      stops: [
        { id: "D", priority: "High", deadline_mins: 30 },
        { id: "H", priority: "Medium", deadline_mins: 60 }
      ]
    };
    
    await fetch(`http://localhost:8000/set_route`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(complexRoute)
    });

    // 2. Start normal
    await triggerEvent('normal');
    
    // 3. Trigger Rain after 3s
    setTimeout(() => triggerEvent('rain'), 3000);
    
    // 4. Trigger Flood and Predictive Slider after 7s
    setTimeout(() => {
        triggerEvent('flood');
        setTimeline(45);
    }, 7000);

    // 5. Restore normal after 20s
    setTimeout(() => {
        triggerEvent('normal');
        setTimeline(0);
    }, 20000);
  };

  return (
    <div className="glass-panel">
      <h2>Simulation Control</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <button className="btn-primary" onClick={() => triggerEvent('normal')}>Initialize / Clear Events</button>
        <button onClick={() => triggerEvent('rain')}>Trigger Rain Module</button>
        <button className="btn-danger" onClick={() => triggerEvent('flood')}>Inject Flood Parameters</button>
        <button onClick={() => triggerEvent('low_fuel')}>Drop Fuel Telemetry</button>
        
        <hr style={{ borderColor: 'rgba(48,54,61,0.5)', margin: '0.4rem 0' }} />
        
        <button 
          onClick={runTurboDemo} 
          style={{ 
            backgroundColor: 'rgba(255, 171, 0, 0.2)', 
            color: '#ffab00', 
            borderColor: '#ffab00',
            fontSize: '1rem',
            padding: '1rem'
          }}
        >
          START 60s TURBO DEMO
        </button>
      </div>
    </div>
  );
}
