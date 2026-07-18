import api from '@/api/axios';

export interface NotificationItem {
  id: number;
  message: string;
  readStatus: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsResponse {
  success: boolean;
  message: string;
  data: NotificationItem[];
  meta?: {
    unreadCount: number;
  };
}

export async function fetchNotifications(): Promise<NotificationsResponse> {
  const res = await api.get('/notifications');
  return res.data;
}

export async function markNotificationRead(id: number): Promise<NotificationItem> {
  const res = await api.patch(`/notifications/${id}/read`);
  return res.data.data;
}

export async function markAllNotificationsRead(): Promise<NotificationItem[]> {
  const res = await api.patch('/notifications/read-all');
  return res.data.data;
}
