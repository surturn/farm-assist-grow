import { Queue } from 'bullmq';
import { redis } from '@farmassist/redis';
import type { InboundJob } from './types';

export const WHATSAPP_INBOUND_QUEUE = 'whatsapp-inbound';

/**
 * Everything Meta sends crosses this queue before any work happens. The
 * webhook must answer within seconds or Meta retries and duplicates the
 * message, so the handler enqueues and returns; the worker does the rest.
 *
 * This boundary is also what makes the documented split into a separate
 * apps/whatsapp service a deploy change rather than a rewrite.
 */
export const inboundQueue = new Queue<InboundJob>(WHATSAPP_INBOUND_QUEUE, {
  connection: redis as any,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    // Failures are kept longer than successes: a job that exhausted its
    // retries is the one worth looking at.
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

/**
 * Meta's message id doubles as the BullMQ job id, so a retried delivery
 * collapses onto the existing job instead of queueing a second one. This is
 * the first of two idempotency layers; the worker checks ChannelEvent as
 * well, because a job removed after completion no longer blocks a re-add.
 */
export async function enqueueInbound(job: InboundJob): Promise<void> {
  await inboundQueue.add(job.kind, job, { jobId: inboundJobId(job) });
}

/**
 * BullMQ rejects a custom job id containing a colon, so the separator is a
 * dash. A status is keyed on id *and* state, because one outbound message
 * legitimately produces sent, delivered and read.
 */
export function inboundJobId(job: InboundJob): string {
  return job.kind === 'message'
    ? `msg-${job.message?.id}`
    : `status-${job.status?.id}-${job.status?.status}`;
}
