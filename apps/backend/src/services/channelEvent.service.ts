import { prisma } from '@farmassist/database';

/**
 * The append-only channel log. Every inbound message and every delivery status
 * callback lands here. It is the evidence base for debugging failures and for
 * defending the Meta quality rating, so nothing in this file updates or
 * deletes a row.
 *
 * Message bodies do not belong here. Store a pointer — a storage key, a Scan
 * id, a FarmNote id — and keep `metadata` to small structured extras.
 */

export type ChannelEventType =
  | 'message.text'
  | 'message.image'
  | 'message.audio'
  | 'message.unsupported'
  | 'command.stop'
  | 'command.language'
  | 'link.token_issued'
  | 'link.completed'
  | 'pin.failed'
  | 'outbound.template'
  | 'outbound.freeform'
  | 'status.sent'
  | 'status.delivered'
  | 'status.read'
  | 'status.failed';

export interface RecordEventInput {
  channelId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: ChannelEventType;
  waMessageId?: string | null;
  payloadRef?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordEvent(input: RecordEventInput) {
  return prisma.channelEvent.create({
    data: {
      channelId: input.channelId,
      direction: input.direction,
      type: input.type,
      waMessageId: input.waMessageId ?? null,
      payloadRef: input.payloadRef ?? null,
      metadata: (input.metadata ?? undefined) as any,
    },
  });
}

export async function listEventsForChannel(channelId: string, limit = 100) {
  return prisma.channelEvent.findMany({
    where: { channelId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Whether a given Meta message has already been logged. The inbound worker
 * consults this before doing any work, so a webhook retry costs one indexed
 * read rather than a duplicate diagnosis.
 */
export async function hasProcessedMessage(waMessageId: string): Promise<boolean> {
  const seen = await prisma.channelEvent.findFirst({
    where: { waMessageId, direction: 'INBOUND' },
    select: { id: true },
  });
  return seen !== null;
}
