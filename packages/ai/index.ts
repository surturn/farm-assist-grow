import { redis } from '@farmassist/redis';
import crypto from 'crypto';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

export const analyzeCropImage = async (imageBase64: string, farmId?: string) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI API key missing');

    // Basic payload size validation
    const sizeInBytes = (imageBase64.length * (3 / 4)) - (imageBase64.endsWith('==') ? 2 : imageBase64.endsWith('=') ? 1 : 0);
    if (sizeInBytes > MAX_IMAGE_SIZE_BYTES) {
        throw new Error('Image size exceeds 10MB limit. Please compress the image.');
    }

    const imageHash = crypto.createHash('sha256').update(imageBase64).digest('hex');
    const cacheKey = `crop_analysis:${imageHash}`;

    // 1. Check Redis Cache
    const cachedResult = await redis.get(cacheKey);
    if (cachedResult) {
        console.log('Cache hit for crop analysis');
        return JSON.parse(cachedResult);
    }

    console.log('Cache miss for crop analysis, calling OpenAI...');

    const systemPrompt = `You are a professional agricultural pathologist and plant disease specialist with expertise in crop pathology, agronomy, and pest management.

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

Diagnostic Rules:

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

    const userPrompt = `Please analyze this crop image for any diseases or health issues.`;
    
    // Model should ideally come from env config, fallback to gpt-4o
    const aiModel = process.env.AI_MODEL || 'gpt-4o';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: aiModel,
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: userPrompt },
                        { type: 'image_url', image_url: { url: imageBase64, detail: 'high' } }
                    ]
                }
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

    const parsedResult = JSON.parse(content);

    // Cache the result. TTL from env, fallback to 7 days
    const ttl = process.env.AI_CACHE_TTL ? parseInt(process.env.AI_CACHE_TTL, 10) : 604800;
    await redis.setex(cacheKey, ttl, JSON.stringify(parsedResult));

    return parsedResult;
};
