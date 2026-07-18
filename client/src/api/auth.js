/**
 * Auth API calls. Thin wrappers over the axios instance so components import named functions
 * (login, register) rather than knowing URL strings. Each returns the unwrapped `data` payload
 * from our { success, message, data } envelope.
 */
import api from './axios.js';

export async function login({ email, password }) {
  const res = await api.post('/auth/login', { email, password });
  return res.data.data; // { token, user }
}

export async function register({ email, password, name }) {
  // Note: no `role` field. The server assigns EMPLOYEE; sending a role would be ignored anyway.
  const res = await api.post('/auth/register', { email, password, name });
  return res.data.data; // { token, user }
}

export async function fetchMe() {
  const res = await api.get('/auth/me');
  return res.data.data.user;
}
