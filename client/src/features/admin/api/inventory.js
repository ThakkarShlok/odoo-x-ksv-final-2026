/** Admin inventory API — physical units ("assets"). */
import api from '@/api/axios';

export async function fetchInventory({ page = 1, limit = 50, status, categoryId } = {}) {
  const res = await api.get('/inventory', { params: { page, limit, status, categoryId } });
  return res.data; // { data:[assets], meta }
}
