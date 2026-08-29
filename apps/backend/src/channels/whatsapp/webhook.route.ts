import { Router, Request, Response } from 'express';
import { env, isWhatsAppConfigured } from '../../config/env';
import { verifyMetaSignature } from './signature';
import { enqueueInbound } from './inbound.queue';
import type { MetaWebhookPayload, InboundJob } from './types';

const router = Router();

/**
 * Meta's verification handshake, sent once when the webhook URL is saved.
 * Echo hub.challenge back only when the token matches ours.
 */
router.get('/', (req: Request, res: Response) => {
  if (!isWhatsAppConfigured()) {
    res.status(503).json({ error: 'WhatsApp channel is not configured' });
    return;
  }

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
    // Meta requires the raw challenge string, not JSON.
    res.status(200).type('text/plain').send(String(challenge ?? ''));
    return;
  }

  console.warn('[whatsapp] webhook verification rejected');
  res.sendStatus(403);
});

/**
 * Message receipt. Verify the signature, enqueue, return 200. Nothing else
 * happens here: Meta retries anything it does not see acknowledged within a
 * few seconds, and a retry storm is how duplicate diagnoses get created.
 */
router.post('/', async (req: Request, res: Response) => {
  if (!isWhatsAppConfigured()) {
    res.status(503).json({ error: 'WhatsApp channel is not configured' });
    return;
  }

  const valid = verifyMetaSignature(
    (req as any).rawBody,
    req.get('x-hub-signature-256'),
    env.WHATSAPP_APP_SECRET as string
  );

  if (!valid) {
    // Rejected before any queue write, per the design spec's failure table.
    console.warn('[whatsapp] rejected webhook with invalid signature');
    res.sendStatus(401);
    return;
  }

  // Acknowledge first. Meta only needs to know we received it, and a slow
  // enqueue must never turn into a redelivery.
  res.sendStatus(200);

  try {
    const payload = req.body as MetaWebhookPayload;
    const receivedAt = new Date().toISOString();

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;

        const phoneNumberId = value.metadata?.phone_number_id ?? '';
        const profileName = value.contacts?.[0]?.profile?.name;

        for (const message of value.messages ?? []) {
          const job: InboundJob = {
            kind: 'message',
            phoneNumberId,
            message,
            profileName,
            receivedAt,
          };
          await enqueueInbound(job);
        }

        for (const status of value.statuses ?? []) {
          await enqueueInbound({ kind: 'status', phoneNumberId, status, receivedAt });
        }
      }
    }
  } catch (error) {
    // The response is already sent; losing the job is better than provoking a
    // redelivery loop, and the failure is visible in the logs.
    console.error('[whatsapp] failed to enqueue inbound payload:', error);
  }
});

export default router;
