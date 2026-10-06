import { redis } from '@farmassist/redis';
import crypto from 'crypto';
import { loadClassManifest } from './manifest';

export { assertKnowledgeMatchesManifest, loadClassManifest, loadKnowledge } from './manifest';
export { decide } from './abstention';
export { loadQuestions, pairFor, nextQuestion, applyAnswer, checkQuestions, type LocalText, type QuestionOption, type Question, type QuestionPair } from './questions';

export interface Analysis {
    diseaseName: string;
    confidence: number; // 0-100
    cropType: string;
    severity: string;
    symptoms: string[];
    possibleCauses: string[];
    treatment: string;
    prevention: string[];
}

const SUPPORTED_CROPS = loadClassManifest().trainedCrops;

const SYSTEM_PROMPT = `You are a professional agricultural pathologist and plant disease specialist with expertise in crop pathology, agronomy, and pest management.

Your task is to analyze the provided crop image and diagnose potential plant diseases based on visible symptoms.

Use established plant pathology knowledge including:
- lesion morphology
- discoloration patterns
- chlorosis
- necrosis
- fungal structures
- pest damage patterns
- environmental stress indicators

Carefully analyze the image before making conclusions.

If the disease is uncertain, choose the most likely diagnosis but reduce confidence appropriately.

You MUST return a valid JSON object with EXACTLY the following structure:

{
  "diseaseName": "Full scientific or common disease name or 'Healthy'",
  "confidence": 0-100,
  "cropType": "Identified crop species",
  "severity": "Healthy | Mild | Moderate | Severe",
  "symptoms": [
    "symptom description",
    "symptom description",
    "symptom description"
  ],
  "possibleCauses": [
    "fungal infection",
    "bacterial infection",
    "nutrient deficiency",
    "pest damage",
    "environmental stress"
  ],
  "treatment": "Detailed treatment steps including recommended fungicides, pesticides, cultural practices, or soil corrections",
  "prevention": [
    "prevention strategy",
    "prevention strategy",
    "prevention strategy"
  ]
}

Supported crops: ${SUPPORTED_CROPS.join(', ')}.

Diagnostic Rules:

0. If the crop is not one of the supported crops, return "diseaseName": "Unsupported crop", the identified "cropType", "confidence": 0, "severity": "Healthy", empty arrays, and "treatment": "". Do not diagnose it.

1. Carefully identify the crop type before diagnosing disease.
2. Evaluate leaf patterns such as spots, lesions, yellowing, wilting, mold growth.
3. Consider disease severity based on the percentage of plant tissue affected.
4. If no disease symptoms are present, return: "diseaseName": "Healthy"
5. Confidence should reflect diagnostic certainty:
   - 90–100: clear textbook symptoms
   - 70–89: likely diagnosis
   - 40–69: possible diagnosis
   - below 40: uncertain
6. Treatments should be agronomically realistic and safe for farmers.
7. Avoid speculation beyond visible symptoms.
8. Use proper plant pathology terminology.

Important:
Return ONLY valid JSON. Do NOT include explanations or extra text.`;

const sha256 = (data: string | Buffer) => crypto.createHash('sha256').update(data).digest('hex');

/**
 * Wrapped in an object so tests can replace diagnose, the same way the
 * integration test stubs authAdmin.verifyIdToken.
 */
export const openaiVision = {
    diagnose: async (image: Buffer, mimeType: string): Promise<{ analysis: Analysis; model: string }> => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OpenAI API key missing');

        const aiModel = process.env.AI_MODEL || 'gpt-4o';
        // The prompt hash is part of the identity: a prompt change is a new
        // model as far as training labels are concerned.
        const model = `openai:${aiModel}@${sha256(SYSTEM_PROMPT).slice(0, 8)}`;
        const cacheKey = `crop_analysis:${model}:${sha256(image)}`;

        // The cache is an optimisation: a Redis outage must not stop diagnosis.
        const cached = await redis.get(cacheKey).catch(() => null);
        if (cached) return { analysis: JSON.parse(cached), model };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: aiModel,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Please analyze this crop image for any diseases or health issues.' },
                            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${image.toString('base64')}`, detail: 'high' } },
                        ],
                    },
                ],
                max_tokens: 1500,
                temperature: 0.2,
                response_format: { type: 'json_object' },
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenAI API Failed: ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('No content returned from OpenAI');

        const analysis = JSON.parse(content) as Analysis;
        if (typeof analysis.diseaseName !== 'string' || typeof analysis.confidence !== 'number') {
            throw new Error('OpenAI returned an analysis without diseaseName/confidence');
        }

        const ttl = process.env.AI_CACHE_TTL ? parseInt(process.env.AI_CACHE_TTL, 10) : 604800;
        await redis.setex(cacheKey, ttl, JSON.stringify(analysis)).catch(() => undefined);
        return { analysis, model };
    },
};
