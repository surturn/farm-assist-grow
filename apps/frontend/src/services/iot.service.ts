import { apiClient } from '../api/client';

export const iotService = {
  pushTelemetry: async (payload: any) => {
    const { data } = await apiClient.post('/iot/telemetry', payload);
    return data;
  }
};
