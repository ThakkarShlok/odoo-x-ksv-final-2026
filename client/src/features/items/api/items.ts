import api from '@/api/axios';
import type { User } from '../../auth/api/auth';

export interface Item {
  id: number;
  name: string;
  status: string;
  createdBy?: User;
  createdAt: string;
  updatedAt: string;
}

export interface ItemsResponse {
  success: boolean;
  message: string;
  data: Item[];
  meta?: {
    count: number;
  };
}

export async function fetchItems(): Promise<ItemsResponse> {
  const res = await api.get('/items');
  return res.data;
}

export async function createItem({ name, status }: { name: string; status: string }): Promise<Item> {
  const res = await api.post('/items', { name, status });
  return res.data.data;
}

export async function updateItemStatus(id: number, status: string): Promise<Item> {
  const res = await api.patch(`/items/${id}/status`, { status });
  return res.data.data;
}
