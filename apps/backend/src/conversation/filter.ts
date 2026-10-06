import sharp from 'sharp';

const MAX_BYTES = 10 * 1024 * 1024;
const MIN_SIDE = 224;
// ponytail: no blur detection; add a Laplacian-variance check if the eval shows blur is a failure mode.

export async function checkImage(bytes: Buffer): Promise<'ok' | 'unreadable' | 'too_small' | 'too_large'> {
  if (bytes.length > MAX_BYTES) return 'too_large';
  try {
    const { width, height } = await sharp(bytes).metadata();
    if (!width || !height) return 'unreadable';
    return Math.min(width, height) < MIN_SIDE ? 'too_small' : 'ok';
  } catch {
    return 'unreadable';
  }
}
