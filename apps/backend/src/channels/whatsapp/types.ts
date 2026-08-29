/**
 * The subset of Meta's webhook payload we actually consume. Deliberately not
 * exhaustive: anything not modelled here is treated as an unsupported message
 * type rather than silently dropped.
 */

export interface MetaTextMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text';
  text: { body: string };
}

export interface MetaMediaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'image' | 'audio' | 'video' | 'document' | 'sticker';
  image?: { id: string; mime_type: string; sha256?: string; caption?: string };
  audio?: { id: string; mime_type: string; voice?: boolean };
  video?: { id: string; mime_type: string };
  document?: { id: string; mime_type: string };
  sticker?: { id: string; mime_type: string };
}

export interface MetaOtherMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
}

export type MetaMessage = MetaTextMessage | MetaMediaMessage | MetaOtherMessage;

export interface MetaStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string; message?: string }>;
}

export interface MetaChangeValue {
  messaging_product: 'whatsapp';
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: Array<{ profile: { name: string }; wa_id: string }>;
  messages?: MetaMessage[];
  statuses?: MetaStatus[];
}

export interface MetaWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{ field: string; value: MetaChangeValue }>;
  }>;
}

/** What the webhook hands to the queue: one message or status, plus context. */
export interface InboundJob {
  kind: 'message' | 'status';
  phoneNumberId: string;
  /** Present for kind === 'message'. */
  message?: MetaMessage;
  /** WhatsApp profile name, when Meta supplies it. */
  profileName?: string;
  /** Present for kind === 'status'. */
  status?: MetaStatus;
  receivedAt: string;
}
