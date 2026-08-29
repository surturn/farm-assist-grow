import { Worker, Job } from 'bullmq';
import { redis } from '@farmassist/redis';
import { WHATSAPP_INBOUND_QUEUE } from './inbound.queue';
import { routeIntent } from './intent.router';
import type { InboundJob } from './types';
import * as farmerService from '../../services/farmer.service';
import * as channelEventService from '../../services/channelEvent.service';
import type { ChannelEventType } from '../../services/channelEvent.service';

/**
 * Consumes the inbound queue. All real processing lives here rather than in
 * the webhook handler, so Meta always gets its fast 200.
 *
 * This module reaches the database only through services/, never through
 * Prisma directly — the invariant that keeps a later split into a standalone
 * apps/whatsapp worker cheap.
 *
 * Milestone 2 scope: identify the sender, log the event, classify the intent,
 * and honour opt-out. Producing replies is Milestone 3 onward; unhandled
 * intents are recorded and left, deliberately, rather than half-answered.
 */

export const WORKER_VERSION = 'inbound@1';

/** Exported for tests: the whole job body, minus the queue plumbing. */
export async function handleInboundJob(job: InboundJob): Promise<void> {
  if (job.kind === 'status') return handleStatus(job);
  return handleMessage(job);
}

async function handleMessage(job: InboundJob): Promise<void> {
  const message = job.message;
  if (!message?.id || !message.from) {
    console.warn('[whatsapp] inbound message missing id or sender, skipping');
    return;
  }

  // Second idempotency layer. The queue's jobId collapses concurrent
  // redeliveries, but a job removed after completion no longer blocks a
  // re-add, and Meta can retry well after that.
  if (await channelEventService.hasProcessedMessage(message.id)) {
    console.log(`[whatsapp] message ${message.id} already processed, skipping`);
    return;
  }

  // Creates the channel on first contact and advances lastInboundAt, which is
  // what reopens the 24-hour service window.
  const channel = await farmerService.touchChannel(message.from);
  const intent = routeIntent(message);

  await channelEventService.recordEvent({
    channelId: channel.id,
    direction: 'INBOUND',
    type: intentToEventType(intent.kind),
    waMessageId: message.id,
    metadata: {
      intent: intent.kind,
      workerVersion: WORKER_VERSION,
      ...(intent.kind === 'message.image' || intent.kind === 'message.audio'
        ? { mediaId: intent.mediaId, mimeType: intent.mimeType }
        : {}),
      ...(intent.kind === 'message.unsupported' ? { messageType: intent.type } : {}),
    },
  });

  switch (intent.kind) {
    case 'command.stop':
      await farmerService.optOut(channel.id);
      console.log(`[whatsapp] channel ${channel.id} opted out`);
      return;

    case 'command.start':
      await farmerService.optIn(channel.id);
      console.log(`[whatsapp] channel ${channel.id} opted back in`);
      return;

    case 'command.language':
      if (intent.language) await farmerService.setLanguage(channel.id, intent.language);
      return;

    default:
      // Diagnosis, farm logging and replies arrive in later milestones. The
      // event above is already recorded, so nothing is lost in the meantime.
      console.log(`[whatsapp] ${intent.kind} from channel ${channel.id} recorded, no handler yet`);
      return;
  }
}

async function handleStatus(job: InboundJob): Promise<void> {
  const status = job.status;
  if (!status?.recipient_id) return;

  // A status callback must not create a channel: it is about a number we
  // already messaged, and inventing a row here would corrupt lastInboundAt.
  const channel = await farmerService.findChannelByPhone(status.recipient_id);
  if (!channel) {
    console.warn(`[whatsapp] status for unknown recipient ${status.recipient_id}`);
    return;
  }

  await channelEventService.recordEvent({
    channelId: channel.id,
    direction: 'OUTBOUND',
    type: `status.${status.status}` as ChannelEventType,
    waMessageId: status.id,
    metadata: status.errors?.length ? { errors: status.errors } : null,
  });
}

function intentToEventType(kind: string): ChannelEventType {
  switch (kind) {
    case 'command.stop':
      return 'command.stop';
    case 'command.language':
      return 'command.language';
    case 'message.image':
      return 'message.image';
    case 'message.audio':
      return 'message.audio';
    case 'message.text':
      return 'message.text';
    default:
      return 'message.unsupported';
  }
}

/**
 * Started from server.ts, not at import time, so that importing the app for a
 * test does not open a queue consumer.
 */
export function startInboundWorker(): Worker<InboundJob> {
  const worker = new Worker<InboundJob>(
    WHATSAPP_INBOUND_QUEUE,
    async (job: Job<InboundJob>) => handleInboundJob(job.data),
    { connection: redis as any, concurrency: 5 }
  );

  worker.on('failed', (job, err) => {
    console.error(`[whatsapp] inbound job ${job?.id} failed: ${err.message}`);
  });

  return worker;
}
