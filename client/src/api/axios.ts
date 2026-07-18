import axios, { AxiosError } from 'axios';

export const TOKEN_KEY = 'zenith.token';
export const USER_KEY = 'zenith.user';

interface ErrorEnvelope {
  success?: boolean;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
}

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL as string) ?? 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;

    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);

      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login?expired=1');
      }
    }

    return Promise.reject(error);
  }
);

export function getErrorMessage(error: any, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ErrorEnvelope | undefined;
    return data?.message ?? error.message ?? fallback;
  }
  return error?.message ?? fallback;
}

export function getFieldErrors(error: any): Array<{ field: string; message: string }> {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ErrorEnvelope | undefined;
    return data?.errors ?? [];
  }
  return [];
}

export default api;
