import { useState, useEffect, useRef } from 'react';

export function useWebSocket(url) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('offline');
  const ws = useRef(null);

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) ws.current.close();
    };
  }, [url]);

  const connect = () => {
    ws.current = new WebSocket(url);
    
    ws.current.onopen = () => {
      setStatus('online');
    };
    
    ws.current.onclose = () => {
      setStatus('offline');
      // Reconnect after 2 seconds
      setTimeout(() => connect(), 2000);
    };
    
    ws.current.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      setData(parsed);
    };
    
    ws.current.onerror = () => {
      setStatus('offline');
    };
  };

  const send = (message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  return { data, status, send };
}
