import React, { useState } from 'react';

export default function RouteBuilder({ nodes }) {
  // Default route: Andheri East area (F = WEH Hub) to Kurla corridor (G = Bandra Kurla Complex)
  const [start, setStart] = useState("F");
  const [end, setEnd]     = useState("G");

  const [stops, setStops] = useState([]);
  
  const addStop = () => {
      if (stops.length >= 6) return; 
      setStops([...stops, { id: "L", priority: "Medium", deadline_mins: 60 }]);
  };

  const removeStop = (idx) => {
      const newStops = [...stops];
      newStops.splice(idx, 1);
      setStops(newStops);
  };
  
  const updateStop = (idx, field, value) => {
      const newStops = [...stops];
      newStops[idx][field] = field === 'deadline_mins' ? parseInt(value) : value;
      setStops(newStops);
  };

  const submitRoute = async () => {
    try {
      await fetch(`http://localhost:8000/set_route`, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start, end, stops })
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (!nodes) return null;
  const locList = Object.keys(nodes).map(key => ({ id: key, name: nodes[key].name }));

  return (
    <div className="glass-panel" style={{ borderLeft: '4px solid #58a6ff' }}>
      <h2>Dynamic Route Builder</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div>
              <span className="stat-label">Origin Facility:</span>
              <select value={start} onChange={e => setStart(e.target.value)} style={{ width: '100%', padding: '0.4rem', marginTop: '0.2rem', background: '#0d1117', color: 'white', border: '1px solid #30363d' }}>
                  {locList.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
          </div>
          
          <div style={{ background: 'rgba(33, 38, 45, 0.3)', padding: '0.5rem', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span className="stat-label">Delivery Stops ({stops.length}/6):</span>
                  <button onClick={addStop} style={{ width: 'auto', padding: '0.2rem 0.6rem', fontSize: '0.75rem', background: 'rgba(88,166,255,0.2)' }}>+ Add</button>
              </div>
              
              {stops.map((stop, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.8rem', paddingBottom: '0.8rem', borderBottom: '1px solid rgba(48,54,61,0.5)' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <select value={stop.id} onChange={e => updateStop(i, 'id', e.target.value)} style={{ flex: 1, padding: '0.3rem', background: '#0d1117', color: 'white', border: '1px solid #30363d' }}>
                              {locList.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                          <button onClick={() => removeStop(i)} style={{ width: '30px', padding: 0, background: 'rgba(218, 54, 51, 0.2)', color: '#ff7b72' }}>X</button>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <select value={stop.priority} onChange={e => updateStop(i, 'priority', e.target.value)} style={{ flex: 1, padding: '0.3rem', background: '#0d1117', color: 'white', border: '1px solid #30363d' }}>
                              <option value="High">High Priority</option>
                              <option value="Medium">Med Priority</option>
                              <option value="Low">Low Priority</option>
                          </select>
                          <select value={stop.deadline_mins} onChange={e => updateStop(i, 'deadline_mins', e.target.value)} style={{ flex: 1, padding: '0.3rem', background: '#0d1117', color: 'white', border: '1px solid #30363d' }}>
                              <option value="30">SLA: +30m</option>
                              <option value="45">SLA: +45m</option>
                              <option value="60">SLA: +60m</option>
                              <option value="90">SLA: +90m</option>
                          </select>
                      </div>
                  </div>
              ))}
          </div>
          
          <div>
              <span className="stat-label">Target Terminus:</span>
              <select value={end} onChange={e => setEnd(e.target.value)} style={{ width: '100%', padding: '0.4rem', marginTop: '0.2rem', background: '#0d1117', color: 'white', border: '1px solid #30363d' }}>
                  {locList.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
          </div>
          
          <button className="btn-primary" onClick={submitRoute} style={{ marginTop: '0.5rem' }}>
            Dispatch Logistics Fleet
          </button>
      </div>
    </div>
  );
}
