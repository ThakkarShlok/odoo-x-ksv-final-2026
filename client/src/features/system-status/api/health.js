import api from '@/api/axios';

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
    const body = error.response?.data;
    return { ok: false, message: body?.message ?? error.message, status: error.response?.status };
  }
}
