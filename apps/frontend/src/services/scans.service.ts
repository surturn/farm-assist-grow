import { apiClient } from '../api/client';

export const scansService = {
  getScans: async (farmId?: string | null) => {
    const { data } = await apiClient.get('/scans', { params: { farmId } });
    return data;
  },
  
  createScan: async (scanPayload: any) => {
    const { data } = await apiClient.post('/scans', scanPayload);
    return data;
  }
};
