import api from '@/api/axios';

export async function login({ email, password }) {
  const res = await api.post('/auth/login', { email, password });
  return {
    token: res.data.data.accessToken,
    user: res.data.data.user
  };
}

export async function register({ email, password, fullName, phoneNumber, address }) {
  const res = await api.post('/auth/register', { email, password, fullName, phoneNumber, address });
  return res.data.data;
}

export async function fetchMe() {
  const res = await api.get('/auth/me');
  return res.data.data.user;
}
