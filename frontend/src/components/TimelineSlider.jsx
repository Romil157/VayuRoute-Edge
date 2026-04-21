import React from 'react';
import { apiUrl } from '../lib/api';

export default function TimelineSlider({ currentHorizon }) {
  const setTimeline = async (val) => {
    try {
      await fetch(apiUrl(`/timeline/${val}`), { method: 'POST' });
    } catch (e) {}
  };

  return (
    <div className="glass-panel">
      <h2>Future Prediction Timeline</h2>
      <div className="slider-container" style={{ padding: '0.5rem 0' }}>
        <input 
          type="range" 
          min="0" max="45" step="15" 
          value={currentHorizon} 
          onChange={(e) => setTimeline(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', color: '#8b949e', fontSize: '0.8rem', fontWeight: 600 }}>
          <span>Now</span>
          <span>15m</span>
          <span>30m</span>
          <span style={{ color: currentHorizon > 30 ? '#58a6ff' : '' }}>45m</span>
        </div>
      </div>
    </div>
  );
}
