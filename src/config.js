// Runtime endpoints. Set at build time via VITE_* env vars (see Dockerfile);
// the fallbacks keep local development working unchanged.
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5245';
export const SIGNALR_HUB_URL = `${import.meta.env.VITE_SIGNALR_URL || API_BASE_URL}/hubs/trip`;
export const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || 'http://localhost:5174/';
