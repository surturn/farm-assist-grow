import type { AdviceView, Lang } from '@farmassist/ai/advice';
import type { Band, RejectReason } from '@farmassist/ai/rules';
import type { ClassManifest, KnowledgeEntry } from '@farmassist/ai/manifest';
import type { QuestionPair } from '@farmassist/ai/questions';

export interface Owner { userId?: string | null; channelId?: string | null }
export interface ScanOriginInput extends Owner { farmId?: string | null; waMessageId?: string | null; mediaId?: string | null; workerVersion?: string | null }
export interface QuestionView { id: string; text: string; options: { id: string; text: string }[] }
export interface DiagnosisStep {
  scanId: string;
  band: Band;
  reason: RejectReason | null;
  label: string | null;
  crop: string | null;
  confidence: number;            // 0-1
  advice: AdviceView | null;     // band === 'confident'
  question: QuestionView | null; // band === 'ask'
}
export interface TraceEntry { tool: string; out: unknown }
export interface ScanState {
  id: string; userId: string | null; channelId: string | null; verifiedLabel: string | null;
  probs: Record<string, number> | null; crop: string | null; answers: { questionId: string; optionId: string }[];
  pendingQuestion: string | null; // the only question that may be answered next
  trace: TraceEntry[];
}
export interface DiagnosisDeps {
  manifest: ClassManifest;
  knowledge: Record<string, KnowledgeEntry>;
  questions: QuestionPair[];
  classify(image: Buffer, mimeType: string): Promise<{ raw: unknown; model: string }>;
  saveImage(bytes: Buffer, mimeType: string): Promise<string>;
  createScan(origin: ScanOriginInput, data: ScanWrite): Promise<{ id: string }>;
  getScan(id: string): Promise<ScanState | null>;
  updateScan(id: string, data: ScanWrite): Promise<void>;
}
export interface ScanWrite {
  imageUrl?: string; diseaseName: string; confidence: number | null; analysis?: unknown; model?: string;
  answers?: { questionId: string; optionId: string }[]; trace: TraceEntry[]; reviewStatus: string | null;
}
export class StaleAnswerError extends Error {}
export interface OutboundMessage { text: string; buttons?: { id: string; title: string }[] }
export type { Lang };
