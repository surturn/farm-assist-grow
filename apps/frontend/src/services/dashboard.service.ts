import { apiClient } from '../api/client';

import type { DashboardData } from '@farmassist/shared-types';

export const dashboardService = {
  getDashboardData: async (farmId?: string | null): Promise<DashboardData> => {
    const { data } = await apiClient.get('/dashboard' + (farmId ? `?farmId=${farmId}` : ''));
    return data;
  }
};
