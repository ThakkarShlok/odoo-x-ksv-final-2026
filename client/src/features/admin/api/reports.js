/** Admin reports API. */
import api from '@/api/axios';

export async function fetchDashboard() {
  const res = await api.get('/reports/dashboard');
  return res.data.data; // { volumes:{...}, financials:{...} }
}
