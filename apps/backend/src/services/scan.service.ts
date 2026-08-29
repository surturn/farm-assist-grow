import { prisma } from '@farmassist/database';

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
