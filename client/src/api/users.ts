import api from './client';
import { User, NotificationPreferences } from '../types';

export interface UpdateUserPayload {
  displayName?: string;
  avatarUrl?: string | null;
  notificationPreferences?: NotificationPreferences;
}

export const usersApi = {
  get: (id: string) => api.get<User>(`/users/${id}`),

  update: (id: string, payload: UpdateUserPayload) => api.put<User>(`/users/${id}`, payload),
};
