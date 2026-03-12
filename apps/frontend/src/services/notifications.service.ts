import { apiClient } from '../api/client';

export const notificationsService = {
  getNotifications: async () => {
    const { data } = await apiClient.get('/notifications');
    return data;
  },

  markAsRead: async (id: string) => {
    const { data } = await apiClient.put(`/notifications/${id}/read`);
    return data;
  },

  markAllAsRead: async () => {
    const { data } = await apiClient.post('/notifications/mark-all-read');
    return data;
  }
};
