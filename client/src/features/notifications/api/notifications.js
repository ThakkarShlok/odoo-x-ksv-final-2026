import api from '@/api/axios';

export async function fetchNotifications(params) {
  const res = await api.get('/notifications', { params });
  return res.data;
}

export async function markAsRead(id) {
  const res = await api.patch(`/notifications/${id}/read`);
  return res.data;
}

export async function markAllAsRead() {
  const res = await api.patch('/notifications/read-all');
  return res.data;
}
