export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

function computeWsBase() {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  if (API_BASE) {
    const wsScheme = API_BASE.startsWith('https:') ? 'wss:' : 'ws:';
    const hostPart = API_BASE.replace(/^https?:\/\//, '');
    return `${wsScheme}//${hostPart}/ws`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

export const WS_BASE = computeWsBase();

export function apiUrl(path = '') {
  if (!path) return API_BASE;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}
