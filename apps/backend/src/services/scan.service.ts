import { prisma } from '@farmassist/database';
import { openaiVision, type Analysis } from '@farmassist/ai';
import { saveScanImage } from './imageStore.service';
import type { ScanOriginInput, ScanState, ScanWrite } from '../conversation/types';

/**
 * Scan persistence. Two callers reach this: the REST controller, where a scan
 * always belongs to a logged-in user, and the WhatsApp worker, where the first
 * scan from an unrecognised number has no user at all and is held against the
 * channel until that farmer registers.
 */

export interface ScanOrigin {
  /** Set for API scans and for channel scans once the number is linked. */
  userId?: string | null;
  /** Set for anything that arrived over WhatsApp. */
  channelId?: string | null;
  /** Meta's message id. Unique, so a replayed webhook is a no-op. */
  waMessageId?: string | null;
  mediaId?: string | null;
  workerVersion?: string | null;
  reviewStatus?: string | null;
}

export interface ScanResult {
  farmId?: string | null;
  imageUrl?: string | null;
  diseaseName?: string | null;
  confidence?: number | null;
  treatment?: string | null;
  analysis?: Analysis | null;
  model?: string | null;
}

export async function listScansForUser(
  userId: string,
  options: { limit?: number; farmId?: string } = {}
) {
  const { limit = 50, farmId } = options;
  return prisma.scan.findMany({
    where: { userId, ...(farmId ? { farmId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function createScan(origin: ScanOrigin, result: ScanResult) {
  return prisma.scan.create({
    data: {
      userId: origin.userId ?? null,
      channelId: origin.channelId ?? null,
      waMessageId: origin.waMessageId ?? null,
      mediaId: origin.mediaId ?? null,
      workerVersion: origin.workerVersion ?? null,
      reviewStatus: origin.reviewStatus ?? null,
      farmId: result.farmId ?? null,
      imageUrl: result.imageUrl ?? null,
      diseaseName: result.diseaseName ?? null,
      confidence: result.confidence ?? null,
      treatment: result.treatment ?? null,
      analysis: (result.analysis ?? undefined) as any,
      model: result.model ?? null,
    },
  });
}

/**
 * Idempotent counterpart of createScan for the inbound worker. Meta retries
 * webhooks, so the same message can arrive more than once; the unique
 * waMessageId turns the repeat into a lookup instead of a duplicate row.
 */
export async function createScanForMessage(
  waMessageId: string,
  origin: Omit<ScanOrigin, 'waMessageId'>,
  result: ScanResult
) {
  const existing = await prisma.scan.findUnique({ where: { waMessageId } });
  if (existing) return { scan: existing, created: false };

  try {
    const scan = await createScan({ ...origin, waMessageId }, result);
    return { scan, created: true };
  } catch (error: any) {
    // Two deliveries of the same message can race past the lookup above.
    if (error?.code === 'P2002') {
      const scan = await prisma.scan.findUnique({ where: { waMessageId } });
      if (scan) return { scan, created: false };
    }
    throw error;
  }
}

export async function countScansForChannel(channelId: string) {
  return prisma.scan.count({ where: { channelId } });
}

/**
 * Called when a channel is linked to a freshly created account: everything the
 * farmer sent before signing up becomes theirs.
 */
export async function backfillChannelScansToUser(channelId: string, userId: string) {
  const { count } = await prisma.scan.updateMany({
    where: { channelId, userId: null },
    data: { userId },
  });
  return count;
}

/**
 * The one place a diagnosis is written. Every surface (dashboard now,
 * WhatsApp and Telegram later) calls this, so every diagnosis leaves a
 * training example: the stored image, the raw model output and the model id.
 * The image is stored before the model runs, so a failed call still keeps it.
 */
export async function diagnoseAndRecord(
  origin: ScanOrigin,
  input: { farmId?: string | null; bytes: Buffer; mimeType: string }
) {
  const imageUrl = await saveScanImage(input.bytes, input.mimeType);
  const { analysis, model } = await openaiVision.diagnose(input.bytes, input.mimeType);
  const scan = await createScan(origin, {
    farmId: input.farmId ?? null,
    imageUrl,
    diseaseName: analysis.diseaseName,
    confidence: analysis.confidence,
    treatment: analysis.treatment || null,
    analysis,
    model,
  });
  return { scan, analysis };
}

/** Returns null when the scan does not exist or is not the caller's. */
export async function verifyScan(
  userId: string,
  scanId: string,
  input: { correct: boolean; label?: string }
) {
  const scan = await prisma.scan.findUnique({ where: { id: scanId } });
  if (!scan || scan.userId !== userId) return null;
  // An agronomist's label outranks the farmer's.
  if (scan.verifiedBy && scan.verifiedBy !== 'farmer') return scan;

  const verifiedLabel = input.correct
    ? scan.diseaseName
    : (input.label?.trim().slice(0, 100) || 'rejected');

  return prisma.scan.update({
    where: { id: scanId },
    data: { verifiedLabel, verifiedBy: 'farmer' },
  });
}

export async function createScanWith(origin: ScanOriginInput, data: ScanWrite) {
  const fields = {
    userId: origin.userId ?? null, channelId: origin.channelId ?? null, farmId: origin.farmId ?? null,
    waMessageId: origin.waMessageId ?? null, mediaId: origin.mediaId ?? null, workerVersion: origin.workerVersion ?? null,
    imageUrl: data.imageUrl ?? null, diseaseName: data.diseaseName, confidence: data.confidence,
    analysis: data.analysis as any, model: data.model ?? null, answers: (data.answers ?? []) as any,
    trace: data.trace as any, reviewStatus: data.reviewStatus,
  };
  if (!origin.waMessageId) return { ...(await prisma.scan.create({ data: fields, select: { id: true } })), created: true };
  // Replayed WhatsApp delivery: report the scan already made for this message.
  const existing = await findScanByMessage(origin.waMessageId);
  if (existing) return { ...existing, created: false };
  try {
    return { ...(await prisma.scan.create({ data: fields, select: { id: true } })), created: true };
  } catch (error: any) {
    // Two deliveries of the same message can race past the lookup above.
    if (error?.code === 'P2002') {
      const scan = await findScanByMessage(origin.waMessageId);
      if (scan) return { ...scan, created: false };
    }
    throw error;
  }
}

export function findScanByMessage(waMessageId: string) {
  return prisma.scan.findUnique({ where: { waMessageId }, select: { id: true } });
}

export async function getScanState(id: string): Promise<ScanState | null> {
  const s = await prisma.scan.findUnique({ where: { id } });
  if (!s) return null;
  const a = (s.analysis ?? {}) as { probs?: Record<string, number>; crop?: string; pendingQuestion?: string | null };
  return {
    id: s.id, userId: s.userId, channelId: s.channelId, verifiedLabel: s.verifiedLabel,
    probs: a.probs ?? null, crop: a.crop ?? null,
    answers: (s.answers ?? []) as ScanState['answers'], pendingQuestion: a.pendingQuestion ?? null, trace: (s.trace ?? []) as any as ScanState['trace'],
  };
}

export async function updateScanState(id: string, data: ScanWrite) {
  const prev = await prisma.scan.findUnique({ where: { id }, select: { analysis: true } });
  await prisma.scan.update({
    where: { id },
    data: {
      diseaseName: data.diseaseName, confidence: data.confidence, reviewStatus: data.reviewStatus,
      analysis: { ...((prev?.analysis as object) ?? {}), ...((data.analysis as object) ?? {}) } as any,
      answers: (data.answers ?? undefined) as any, trace: data.trace as any,
    },
  });
}
