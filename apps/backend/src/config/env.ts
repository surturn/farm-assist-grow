import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env variables locally
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
console.log({
    DATABASE_URL: process.env.DATABASE_URL,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? "Loaded" : "Missing",
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? "Loaded" : "Missing",
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? "Loaded" : "Missing"
});
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
    console.error(' Invalid environment variables:', _env.error.format());
    throw new Error('Invalid environment variables');
}

export const env = _env.data;
