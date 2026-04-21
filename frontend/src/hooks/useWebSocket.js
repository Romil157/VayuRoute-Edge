import { useEffect, useRef, useState } from 'react';

export function useWebSocket(url) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('offline');
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const closedRef = useRef(false);

  useEffect(() => {
    closedRef.current = false;

    const connect = () => {
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        setStatus('online');
      };

      socket.onmessage = (event) => {
        setData(JSON.parse(event.data));
      };

      socket.onerror = () => {
        setStatus('offline');
      };

      socket.onclose = () => {
        setStatus('offline');
        if (closedRef.current) {
          return;
        }
        reconnectTimerRef.current = window.setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      closedRef.current = true;
      window.clearTimeout(reconnectTimerRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [url]);

  const send = (message) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  };

  return { data, status, send };
}
