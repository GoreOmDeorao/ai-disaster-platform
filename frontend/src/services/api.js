import axios from 'axios';

export const API_BASE =
  (typeof process !== 'undefined' && process.env.REACT_APP_API_URL) || 'http://127.0.0.1:8080';

export const ML_BASE =
  (typeof process !== 'undefined' && process.env.REACT_APP_ML_URL) || 'http://127.0.0.1:8000';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: { Accept: 'application/json' },
});

const mlClient = axios.create({
  baseURL: ML_BASE,
  timeout: 15000,
  headers: { Accept: 'application/json' },
});

export async function fetchHealth() {
  const res = await client.get('/health');
  return res.data;
}

export async function fetchMlHealth() {
  try {
    const res = await mlClient.get('/health');
    return res.data;
  } catch {
    return null;
  }
}

/** @returns {{ live: boolean, ready: boolean, checks?: object }} */
export async function fetchApiStatus() {
  try {
    const data = await fetchHealth();
    return { live: true, ready: !!data.ready, checks: data.checks };
  } catch {
    return { live: false, ready: false };
  }
}

export async function fetchAlerts(limit = 50) {
  const res = await client.get(`/api/v1/alerts?limit=${limit}`);
  return res.data.alerts || [];
}

export async function fetchSensors() {
  const res = await client.get('/api/v1/sensors');
  return res.data.sensors || [];
}

export async function acknowledgeAlert(id) {
  const res = await client.put(`/api/v1/alerts/${id}/acknowledge`);
  return res.data;
}

export async function sendBroadcast(data) {
  const res = await client.post('/api/v1/broadcasts', data);
  return res.data;
}

export async function fetchBroadcasts() {
  const res = await client.get('/api/v1/broadcasts');
  return res.data.broadcasts || [];
}

export async function fetchActiveBroadcasts() {
  const res = await client.get('/api/v1/broadcasts/active');
  return res.data.broadcasts || [];
}

export async function deactivateBroadcast(id) {
  const res = await client.put(`/api/v1/broadcasts/${id}/deactivate`);
  return res.data;
}

export async function fetchShelters() {
  const res = await client.get('/api/v1/shelters');
  return res.data.shelters || [];
}

export async function fetchNearbyShelters(lat, lng, radius = 50) {
  const res = await client.get('/api/v1/shelters/nearby', { params: { lat, lng, radius } });
  return res.data.shelters || [];
}

export async function fetchStats() {
  const res = await client.get('/api/v1/stats');
  return res.data;
}

export async function triggerSoundAlert(data) {
  const res = await client.post('/api/v1/alerts/trigger-sound', data);
  return res.data;
}
