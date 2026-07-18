/** Notification API calls for the bell. Returns the full envelope so meta.unreadCount is available. */
import api from './axios.js';

export async function fetchNotifications() {
  const res = await api.get('/notifications');
  return res.data; // { data:[...], meta:{ unreadCount } }
}

export async function markNotificationRead(id) {
  const res = await api.patch(`/notifications/${id}/read`);
  return res.data.data;
}

export async function markAllNotificationsRead() {
  const res = await api.patch('/notifications/read-all');
  return res.data.data;
}
