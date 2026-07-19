import api from '@/api/axios';

export async function login({ email, password }) {
  const res = await api.post('/auth/login', { email, password });
  const { accessToken, user } = res.data.data;
  return { token: accessToken, user };
}

export async function register({ fullName, email, password, phoneNumber, address }) {
  const res = await api.post('/auth/register', { fullName, email, password, phoneNumber, address });
  // Registration doesn't return a token — login after register
  const loginRes = await api.post('/auth/login', { email, password });
  const { accessToken, user } = loginRes.data.data;
  return { token: accessToken, user };
}

export async function fetchMe() {
  const res = await api.get('/auth/me');
  return res.data.data.user;
}
