import api from '@/api/axios';

export async function fetchNotifications() {
  const res = await api.get('/notifications');
  return res.data;
}

export async function markNotificationRead(id) {
  const res = await api.patch(`/notifications/${id}/read`);
  return res.data.data;
}

export async function markAllNotificationsRead() {
  const res = await api.patch('/notifications/read-all');
  return res.data.data;
}
