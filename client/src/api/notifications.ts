import api from './client';
import { Notification } from '../types';

export const notificationsApi = {
  list: () => api.get<Notification[]>('/notifications'),

  markRead: (id: string) => api.put<Notification>(`/notifications/${id}/read`),

  markAllRead: () => api.put('/notifications/read-all'),
};
