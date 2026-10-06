import { apiClient } from '../api/client';

export interface Analysis {
  diseaseName: string;
  confidence: number;
  cropType: string;
  severity: string;
  symptoms: string[];
  possibleCauses: string[];
  treatment: string;
  prevention: string[];
}

export interface ScanRow {
  id: string;
  farmId: string | null;
  diseaseName: string | null;
  confidence: number | null;
  analysis: Analysis | null;
  verifiedLabel: string | null;
  verifiedBy: string | null;
  createdAt: string;
}

export const scansService = {
  list: async (farmId?: string | null): Promise<ScanRow[]> => {
    const { data } = await apiClient.get('/scans', { params: { farmId } });
    return data;
  },
  diagnose: async (imageBase64: string, farmId?: string | null): Promise<{ scan: ScanRow; analysis: Analysis }> => {
    const { data } = await apiClient.post('/scans', { imageBase64, farmId: farmId || undefined });
    return data;
  },
  verify: async (scanId: string, correct: boolean, label?: string): Promise<ScanRow> => {
    const { data } = await apiClient.patch(`/scans/${scanId}/verify`, { correct, label });
    return data;
  },
};
