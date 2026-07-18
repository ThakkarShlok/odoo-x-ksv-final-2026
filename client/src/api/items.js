/** Item API calls. Returns the full envelope where `meta` is needed, else the data payload. */
import api from './axios.js';

export async function fetchItems() {
  const res = await api.get('/items');
  return res.data; // full envelope: { success, message, data, meta:{count} }
}

export async function createItem({ name, status }) {
  const res = await api.post('/items', { name, status });
  return res.data.data;
}

export async function updateItemStatus(id, status) {
  const res = await api.patch(`/items/${id}/status`, { status });
  return res.data.data;
}
