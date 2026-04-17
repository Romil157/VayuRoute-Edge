import React from 'react';

export default function SystemLog({ logs }) {
  if (!logs) return null;

  return (
    <div className="glass-panel">
      <h2>System Event Log</h2>
      <div className="system-log-container">
        {logs.map((log, i) => (
          <div key={i} className="system-log-line">
            {log}
          </div>
        ))}
      </div>
    </div>
  );
}
