/**
 * Auth API calls — shaped to the REAL backend contract (verified live):
 *   login    → { data: { accessToken, user{ id, fullName, email, role, phoneNumber, address } } }
 *   register → { data: { user } }   (NO token — the caller must log in after; see AuthContext)
 *   me       → { data: { user } }
 * register requires fullName / phoneNumber / address (not `name`), enforced server-side.
 */
import api from '@/api/axios';

export async function login({ email, password }) {
  const res = await api.post('/auth/login', { email, password });
  return res.data.data; // { accessToken, user }
}

export async function register({ fullName, email, password, phoneNumber, address }) {
  const res = await api.post('/auth/register', { fullName, email, password, phoneNumber, address });
  return res.data.data; // { user } — no token
}

export async function fetchMe() {
  const res = await api.get('/auth/me');
  return res.data.data.user;
}

export async function logout() {
  // Clears the httpOnly refresh cookie server-side.
  try {
    await api.post('/auth/logout', {});
  } catch {
    // Best-effort; local state is cleared regardless by the caller.
  }
}
