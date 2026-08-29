import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env variables locally
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });


const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('5000'),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url().optional(),
    OPENAI_API_KEY: z.string().min(1),
    FIREBASE_PROJECT_ID: z.string().min(1),
    FIREBASE_CLIENT_EMAIL: z.string().email(),
    FIREBASE_PRIVATE_KEY: z.string().min(1),

    // WhatsApp Business Platform. Optional so the API still boots without the
    // channel configured; isWhatsAppConfigured() below is the runtime gate.
    WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
    WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().min(1).optional(),
    WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
    /** App secret, used to verify the HMAC-SHA256 signature Meta sends. */
    WHATSAPP_APP_SECRET: z.string().min(1).optional(),
    /** Our own string, echoed back during Meta's webhook GET handshake. */
    WHATSAPP_VERIFY_TOKEN: z.string().min(1).optional(),
    WHATSAPP_API_VERSION: z.string().default('v26.0'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
    console.error(' Invalid environment variables:', _env.error.format());
    throw new Error('Invalid environment variables');
}

export const env = _env.data;

/**
 * Whether the WhatsApp channel has everything it needs. The webhook refuses
 * to serve rather than falling back to an unverified mode, because a webhook
 * that accepts unsigned requests is worse than one that is switched off.
 */
export function isWhatsAppConfigured(): boolean {
    return Boolean(
        env.WHATSAPP_PHONE_NUMBER_ID &&
        env.WHATSAPP_ACCESS_TOKEN &&
        env.WHATSAPP_APP_SECRET &&
        env.WHATSAPP_VERIFY_TOKEN
    );
}
