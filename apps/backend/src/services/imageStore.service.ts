import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/**
 * Scan images are the training set, so they are kept out of public/ and are
 * never served. Content-addressed: the same photo uploaded twice is one file.
 */
// ponytail: local disk; move to object storage when the backend runs on more than one host.
export const SCAN_IMAGE_DIR = process.env.SCAN_IMAGE_DIR || path.join(__dirname, '../../data/scans');

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export function parseImageDataUrl(dataUrl: unknown): { bytes: Buffer; mimeType: string } | { error: string } {
    if (typeof dataUrl !== 'string') return { error: 'imageBase64 must be a data URL string' };
    const match = DATA_URL.exec(dataUrl);
    if (!match) return { error: 'imageBase64 must be a JPEG, PNG or WebP data URL' };
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length === 0) return { error: 'Image is empty' };
    if (bytes.length > MAX_IMAGE_BYTES) return { error: 'Image exceeds 10MB' };
    return { bytes, mimeType: match[1] };
}

export async function saveScanImage(bytes: Buffer, mimeType: string): Promise<string> {
    const name = `${crypto.createHash('sha256').update(bytes).digest('hex')}.${EXTENSIONS[mimeType] ?? 'bin'}`;
    await fs.mkdir(SCAN_IMAGE_DIR, { recursive: true });
    try {
        await fs.writeFile(path.join(SCAN_IMAGE_DIR, name), bytes, { flag: 'wx' });
    } catch (error: any) {
        if (error?.code !== 'EEXIST') throw error;
    }
    return `scans/${name}`;
}
