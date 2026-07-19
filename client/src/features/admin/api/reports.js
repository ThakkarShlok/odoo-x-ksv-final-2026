/** Admin reports API. */
import api from '@/api/axios';

export async function fetchDashboard() {
  const res = await api.get('/reports/dashboard');
  return res.data.data; // { volumes:{...}, financials:{...} }
}

export async function fetchProfitLoss() {
  const res = await api.get('/reports/profit-loss');
  return res.data.data; // { productProfitability: [...], noiTrend: [...], cashFlowTrend: [...] }
}
