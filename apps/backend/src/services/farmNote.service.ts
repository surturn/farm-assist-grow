import { prisma } from '@farmassist/database';

/**
 * Farm log persistence. A note is either text or a voice note; voice notes are
 * stored as the entry itself and played back in the dashboard, with no
 * transcription, so `note` is empty whenever `audioUrl` is set.
 */

export interface FarmNoteOrigin {
  userId: string;
  channelId?: string | null;
  waMessageId?: string | null;
  workerVersion?: string | null;
}

export interface FarmNoteBody {
  /** Resolved later when the farmer owns more than one farm. */
  farmId?: string | null;
  note?: string | null;
  audioUrl?: string | null;
}

export async function listFarmNotesForUser(userId: string, options: { farmId?: string } = {}) {
  return prisma.farmNote.findMany({
    where: { userId, ...(options.farmId ? { farmId: options.farmId } : {}) },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createFarmNote(origin: FarmNoteOrigin, body: FarmNoteBody) {
  if (!body.note && !body.audioUrl) {
    throw new Error('A farm note needs either text or an audio recording');
  }

  return prisma.farmNote.create({
    data: {
      userId: origin.userId,
      channelId: origin.channelId ?? null,
      waMessageId: origin.waMessageId ?? null,
      workerVersion: origin.workerVersion ?? null,
      farmId: body.farmId ?? null,
      note: body.note ?? null,
      audioUrl: body.audioUrl ?? null,
    },
  });
}

/** Idempotent creation for the inbound worker; see scan.service for the reasoning. */
export async function createFarmNoteForMessage(
  waMessageId: string,
  origin: Omit<FarmNoteOrigin, 'waMessageId'>,
  body: FarmNoteBody
) {
  const existing = await prisma.farmNote.findUnique({ where: { waMessageId } });
  if (existing) return { note: existing, created: false };

  try {
    const note = await createFarmNote({ ...origin, waMessageId }, body);
    return { note, created: true };
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const note = await prisma.farmNote.findUnique({ where: { waMessageId } });
      if (note) return { note, created: false };
    }
    throw error;
  }
}

/**
 * Which farm a note belongs to, when the farmer did not say. Returns the id
 * when they own exactly one farm and null when the caller must ask.
 */
export async function resolveSoleFarmForUser(userId: string): Promise<string | null> {
  const farms = await prisma.farm.findMany({
    where: { tenant: { members: { some: { userId } } } },
    select: { id: true },
    take: 2,
  });
  return farms.length === 1 ? farms[0].id : null;
}
