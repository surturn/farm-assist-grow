import { apiClient } from '../api/client';

export interface AdviceView {
  label: string;
  diseaseName: string;
  symptoms: string[];
  treatment: string | null;
  prevention: string[];
  chemicals: { activeIngredient: string; pcpbReg: string }[];
  source: { title: string; url: string } | null;
  healthy: boolean;
}

export interface DiagnosisStep {
  scanId: string;
  band: 'confident' | 'ask' | 'uncertain' | 'rejected';
  reason: 'unsupported' | 'not_plant' | 'unreadable' | null;
  label: string | null;
  crop: string | null;
  confidence: number; // 0-1
  advice: AdviceView | null;
  question: { id: string; text: string; options: { id: string; text: string }[] } | null;
}

export interface ScanRow {
  id: string;
  farmId: string | null;
  diseaseName: string | null;
  confidence: number | null;
  analysis: { crop?: string; probs?: Record<string, number> } | null;
  verifiedLabel: string | null;
  verifiedBy: string | null;
  createdAt: string;
}

export const scansService = {
  list: async (farmId?: string | null): Promise<ScanRow[]> => {
    const { data } = await apiClient.get('/scans', { params: { farmId } });
    return data;
  },
  diagnose: async (imageBase64: string, farmId?: string | null): Promise<DiagnosisStep> => {
    const { data } = await apiClient.post('/scans', { imageBase64, farmId: farmId || undefined });
    return data.step;
  },
  answer: async (scanId: string, questionId: string, optionId: string): Promise<DiagnosisStep> => {
    const { data } = await apiClient.post(`/scans/${scanId}/answer`, { questionId, optionId });
    return data.step;
  },
  verify: async (scanId: string, correct: boolean, label?: string): Promise<ScanRow> => {
    const { data } = await apiClient.patch(`/scans/${scanId}/verify`, { correct, label });
    return data;
  },
};
