/**
 * The single axios instance. Matches the REAL backend auth contract:
 *   - login/refresh return a short-lived access token in the body (`data.accessToken`, 15 min);
 *   - a refresh token lives in an httpOnly SameSite=Strict cookie the browser holds.
 * So: we send the access token as a Bearer header, `withCredentials` so the refresh cookie rides
 * along, and on a 401 we transparently hit /auth/refresh once to mint a new access token and
 * retry the original request. Only if refresh also fails do we log out.
 */
import axios from 'axios';

export const TOKEN_KEY = 'zenith.token';
export const USER_KEY = 'zenith.user';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
  // REQUIRED for the httpOnly refresh cookie to be sent/received cross-origin (client :5173 →
  // api :5000). The server's CORS is origin-locked with credentials:true to match.
  withCredentials: true,
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Single-flight refresh: if several requests 401 at once, they all await ONE refresh call
// instead of stampeding /auth/refresh.
let refreshing = null;

async function doRefresh() {
  // Bare axios (not `api`) so this call itself can't recurse through this interceptor.
  const res = await axios.post(
    `${api.defaults.baseURL}/auth/refresh`,
    {},
    { withCredentials: true }
  );
  const token = res.data?.data?.accessToken;
  if (!token) throw new Error('No access token in refresh response.');
  localStorage.setItem(TOKEN_KEY, token);
  return token;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // Don't try to refresh the auth calls themselves, and only retry a given request once.
    const isAuthCall = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh');

    if (status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        refreshing = refreshing ?? doRefresh();
        const token = await refreshing;
        refreshing = null;
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${token}`;
        return api(original); // replay the original request with the fresh token
      } catch (refreshErr) {
        refreshing = null;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        if (!window.location.pathname.startsWith('/login')) {
          window.location.assign('/login?expired=1');
        }
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  return error?.message ?? fallback;
}

export function getFieldErrors(error) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.errors ?? [];
  }
  return [];
}

export default api;
