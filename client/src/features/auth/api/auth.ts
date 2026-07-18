import api from '@/api/axios';

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export async function login({ email, password }: Record<string, string>): Promise<AuthResponse> {
  const res = await api.post('/auth/login', { email, password });
  return res.data.data;
}

export async function register({ email, password, name }: Record<string, string>): Promise<AuthResponse> {
  const res = await api.post('/auth/register', { email, password, name });
  return res.data.data;
}

export async function fetchMe(): Promise<User> {
  const res = await api.get('/auth/me');
  return res.data.data.user;
}
