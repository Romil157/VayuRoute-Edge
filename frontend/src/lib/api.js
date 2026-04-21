const DEFAULT_API_ORIGIN = 'http://127.0.0.1:8000';
const runtimeApiOrigin = import.meta.env.VITE_API_ORIGIN || DEFAULT_API_ORIGIN;

export const API_ORIGIN = runtimeApiOrigin.replace(/\/$/, '');
export const WS_ORIGIN = (import.meta.env.VITE_WS_ORIGIN || API_ORIGIN).replace(/^http/, 'ws');

export function apiUrl(path) {
  return `${API_ORIGIN}${path}`;
}

export function wsUrl(path) {
  return `${WS_ORIGIN}${path}`;
}
