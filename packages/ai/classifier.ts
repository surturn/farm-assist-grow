import crypto from 'crypto';
import { redis } from '@farmassist/redis';
import { loadClassManifest } from './manifest';

export interface ClassifierResult { raw: unknown; model: string }

const manifest = loadClassManifest();
const CROPS = [...manifest.trainedCrops, 'Unsupported', 'NotAPlant'];

const SYSTEM_PROMPT = `You are a plant pathologist classifying a single crop photo.
Supported crops: ${manifest.trainedCrops.join(', ')}.
1. Identify the crop. If there is no plant, crop = "NotAPlant". If it is a plant but not a supported crop, crop = "Unsupported".
2. For a supported crop, return up to 3 labels from the allowed list for THAT crop only, with probability scores that sum to at most 1.
3. Base scores only on visible symptoms. Do not give advice. Return JSON only.`;

const SCHEMA = {
    name: 'crop_classification',
    strict: true,
    schema: {
        type: 'object',
        additionalProperties: false,
        required: ['crop', 'predictions'],
        properties: {
            crop: { type: 'string', enum: CROPS },
            predictions: {
                type: 'array',
                maxItems: 3,
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['label', 'score'],
                    properties: { label: { type: 'string', enum: manifest.classes }, score: { type: 'number' } },
                },
            },
        },
    },
};

const sha256 = (data: string | Buffer) => crypto.createHash('sha256').update(data).digest('hex');

/** Object so tests can replace classify, the same way they stub authAdmin. */
export const classifier = {
    classify: async (image: Buffer, mimeType: string): Promise<ClassifierResult> => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OpenAI API key missing');
        const aiModel = process.env.AI_MODEL || 'gpt-4o';
        const model = `openai:${aiModel}@${sha256(SYSTEM_PROMPT + manifest.version).slice(0, 8)}`;
        const cacheKey = `crop_classify:${model}:${sha256(image)}`;

        const cached = await redis.get(cacheKey).catch(() => null);
        if (cached) return { raw: JSON.parse(cached), model };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: aiModel,
                temperature: 0,
                max_tokens: 300,
                response_format: { type: 'json_schema', json_schema: SCHEMA },
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: [{ type: 'image_url', image_url: { url: `data:${mimeType};base64,${image.toString('base64')}`, detail: 'high' } }] },
                ],
            }),
        });
        if (!response.ok) throw new Error(`OpenAI API failed: ${response.status}`);
        const content = (await response.json()).choices?.[0]?.message?.content;
        if (!content) throw new Error('No content returned from OpenAI');
        // Parse only; validation is the checker's job, so a malformed answer
        // is still captured as a training example.
        let raw: unknown;
        try { raw = JSON.parse(content); } catch { raw = content; }
        await redis.setex(cacheKey, 604800, JSON.stringify(raw)).catch(() => undefined);
        return { raw, model };
    },
};
