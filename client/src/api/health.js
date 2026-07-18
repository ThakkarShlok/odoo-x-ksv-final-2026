/**
 * Health API calls for the System Status page.
 * These deliberately DO NOT throw on a failed health check the way other calls do: a 503 from
 * /health/database is expected information ("DB is down"), not an exception. We return a normal
 * result object so the page can render a red card instead of falling into an error boundary.
 */
import api from './axios.js';

export async function checkServer() {
  try {
    const res = await api.get('/health');
    return { ok: true, ...res.data };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

export async function checkDatabase() {
  try {
    const res = await api.get('/health/database');
    return { ok: true, ...res.data };
  } catch (error) {
    // A 503 lands here. Surface the server's message if it sent our envelope, else the network
    // error. Never surface a stack — the server already refuses to send one.
    const body = error.response?.data;
    return { ok: false, message: body?.message ?? error.message, status: error.response?.status };
  }
}
