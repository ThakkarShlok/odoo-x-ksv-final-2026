import api from '@/api/axios';

export async function fetchItems() {
  const res = await api.get('/items');
  return res.data;
}

export async function createItem({ name, status }) {
  const res = await api.post('/items', { name, status });
  return res.data.data;
}

export async function updateItemStatus(id, status) {
  const res = await api.patch(`/items/${id}/status`, { status });
  return res.data.data;
}
