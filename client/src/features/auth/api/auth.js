import api from '@/api/axios';

export async function login({ email, password }) {
  const res = await api.post('/auth/login', { email, password });
  return res.data.data;
}

export async function register({ email, password, name }) {
  const res = await api.post('/auth/register', { email, password, name });
  return res.data.data;
}

export async function fetchMe() {
  const res = await api.get('/auth/me');
  return res.data.data.user;
}
