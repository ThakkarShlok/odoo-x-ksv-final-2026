import api from '@/api/axios';

export interface HealthResponse {
  ok: boolean;
  success?: boolean;
  message?: string;
  status?: number;
  data?: {
    latencyMs?: number;
  };
}

export async function checkServer(): Promise<HealthResponse> {
  try {
    const res = await api.get('/health');
    return { ok: true, ...res.data };
  } catch (error: any) {
    return { ok: false, message: error.message };
  }
}

export async function checkDatabase(): Promise<HealthResponse> {
  try {
    const res = await api.get('/health/database');
    return { ok: true, ...res.data };
  } catch (error: any) {
    const body = error.response?.data;
    return { ok: false, message: body?.message ?? error.message, status: error.response?.status };
  }
}
