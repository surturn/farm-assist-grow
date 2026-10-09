import { env } from '../../config/env';
import * as channelEventService from '../../services/channelEvent.service';
import { isServiceWindowOpen } from '../../services/farmer.service';
import type { OutboundMessage } from '../../conversation/types';
import { graph } from './graph';

export function toMetaPayload(to: string, m: OutboundMessage) {
  const recipient = to.replace(/^\+/, '');
  if (!m.buttons?.length) return { messaging_product: 'whatsapp', to: recipient, type: 'text', text: { body: m.text } };
  return {
    messaging_product: 'whatsapp', to: recipient, type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: m.text },
      action: { buttons: m.buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) },
    },
  };
}

/** Free-form replies only inside Meta's 24-hour window, enforced here rather than at Meta. */
export async function sendMessages(channel: { id: string; phone: string; lastInboundAt: Date | null }, messages: OutboundMessage[]): Promise<number> {
  if (!isServiceWindowOpen(channel.lastInboundAt)) {
    console.warn(`[whatsapp] window closed for channel ${channel.id}; ${messages.length} message(s) not sent`);
    return 0;
  }
  let sent = 0;
  for (const m of messages) {
    const res = await graph.post(`/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, toMetaPayload(channel.phone, m));
    await channelEventService.recordEvent({
      channelId: channel.id, direction: 'OUTBOUND', type: 'outbound.freeform',
      waMessageId: res?.messages?.[0]?.id ?? null, metadata: { buttons: m.buttons?.length ?? 0 },
    });
    sent++;
  }
  return sent;
}
