import { env } from '../../config/env';

const base = () => `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}`;
const auth = () => ({ Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` });

/** Object so tests replace calls instead of the global fetch the test server also uses. */
export const graph = {
  async post(path: string, body: unknown): Promise<any> {
    const r = await fetch(`${base()}${path}`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`Graph POST ${path} failed: ${r.status} ${await r.text()}`);
    return r.json();
  },
  async getJson(path: string): Promise<any> {
    const r = await fetch(`${base()}${path}`, { headers: auth() });
    if (!r.ok) throw new Error(`Graph GET ${path} failed: ${r.status}`);
    return r.json();
  },
  async getBytes(url: string): Promise<Buffer> {
    const r = await fetch(url, { headers: auth() });
    if (!r.ok) throw new Error(`media download failed: ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  },
};

export class MediaTooLargeError extends Error {}
const MAX_MEDIA = 10 * 1024 * 1024;

export async function downloadMedia(mediaId: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const meta = await graph.getJson(`/${encodeURIComponent(mediaId)}`);
  if (typeof meta.file_size === 'number' && meta.file_size > MAX_MEDIA) throw new MediaTooLargeError(String(meta.file_size));
  const bytes = await graph.getBytes(meta.url);
  if (bytes.length > MAX_MEDIA) throw new MediaTooLargeError(String(bytes.length));
  return { bytes, mimeType: meta.mime_type };
}
