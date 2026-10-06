/**
 * The diagnosis cache is an optimisation: a Redis outage must not take
 * diagnosis down with it.
 *
 *   npm run test:ai-cache
 *
 * Points the client at a closed port so every Redis call fails, and stubs
 * fetch so no OpenAI call is made.
 */
import assert from 'node:assert/strict';

process.env.REDIS_URL = 'redis://127.0.0.1:1';
process.env.OPENAI_API_KEY = 'test';

const fakeAnalysis = {
    diseaseName: 'Tomato Early Blight', confidence: 88, cropType: 'Tomato', severity: 'Mild',
    symptoms: [], possibleCauses: [], treatment: '', prevention: [],
};
(globalThis as any).fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(fakeAnalysis) } }] }),
});

(async () => {
    const { openaiVision } = require('@farmassist/ai');
    const { redis } = require('@farmassist/redis');
    // Wait for the client to give up reconnecting, so get/setex reject.
    for (let i = 0; i < 50 && redis.status !== 'end'; i++) await new Promise((r) => setTimeout(r, 100));

    const { analysis, model } = await openaiVision.diagnose(Buffer.from('fake-image'), 'image/jpeg');
    assert.equal(analysis.diseaseName, 'Tomato Early Blight');
    assert.match(model, /^openai:/);
    console.log('ok  diagnosis survives a Redis outage\n\n1 passed');
    process.exit(0);
})().catch((error) => {
    console.error('FAIL  diagnosis survives a Redis outage:', error?.message || error);
    process.exit(1);
});
