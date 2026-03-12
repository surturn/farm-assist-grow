import { apiClient } from '../api/client';

export const scansService = {
  getScans: async () => {
    const { data } = await apiClient.get('/scans');
    return data;
  },
  
  createScan: async (scanPayload: any) => {
    const { data } = await apiClient.post('/scans', scanPayload);
    return data;
  }
};
