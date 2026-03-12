import { apiClient } from '../api/client';

import type { DashboardData } from '@farmassist/shared-types';

export const dashboardService = {
  getDashboardData: async (): Promise<DashboardData> => {
    const { data } = await apiClient.get('/dashboard');
    return data;
  }
};
