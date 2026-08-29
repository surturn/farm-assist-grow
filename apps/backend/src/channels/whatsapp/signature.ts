import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Meta signs every webhook delivery with an HMAC-SHA256 of the raw request
 * body, keyed on the app secret, sent as `X-Hub-Signature-256: sha256=<hex>`.
 *
 * This is the only thing standing between the public internet and the inbound
 * queue. Anyone can POST to the webhook URL; without this check they could
 * fabricate messages from any phone number, which means fabricating scans and
 * farm notes attributed to a real farmer.
 *
 * Two properties matter and are easy to lose:
 *
 * 1. The signature covers the RAW bytes. Re-serialising the parsed JSON gives
 *    different bytes for the same document (key order, whitespace, unicode
 *    escapes), so the comparison must run against the untouched buffer.
 * 2. The comparison must be timing-safe. A byte-by-byte early return leaks how
 *    much of a guessed signature was correct, which is enough to forge one.
 */
export function verifyMetaSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
  appSecret: string
): boolean {
  if (!rawBody || !signatureHeader) return false;

  const [scheme, provided] = signatureHeader.split('=');
  if (scheme !== 'sha256' || !provided) return false;

  const expected = createHmac('sha256', appSecret).update(rawBody).digest();

  let providedBuffer: Buffer;
  try {
    providedBuffer = Buffer.from(provided, 'hex');
  } catch {
    return false;
  }

  // timingSafeEqual throws on a length mismatch, which would itself be a
  // timing signal, so the lengths are compared first and deliberately.
  if (providedBuffer.length !== expected.length) return false;

  return timingSafeEqual(providedBuffer, expected);
}
