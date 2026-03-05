import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load the shared .env.local file from the workspace root
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('5000'),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url().optional(),
    OPENAI_API_KEY: z.string().min(1),
    FIREBASE_PROJECT_ID: z.string().min(1),
    FIREBASE_CLIENT_EMAIL: z.string().email(),
    FIREBASE_PRIVATE_KEY: z.string().min(1),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
    console.error('❌ Invalid environment variables:', _env.error.format());
    throw new Error('Invalid environment variables');
}

export const env = _env.data;
