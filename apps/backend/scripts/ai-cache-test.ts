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

const fakeRaw = { crop: 'Tomato', predictions: [{ label: 'Tomato___Early_Blight', score: 0.9 }] };
(globalThis as any).fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(fakeRaw) } }] }),
});

(async () => {
    const { classifier } = require('@farmassist/ai/classifier');
    const { redis } = require('@farmassist/redis');
    // Wait for the client to give up reconnecting, so get/setex reject.
    for (let i = 0; i < 50 && redis.status !== 'end'; i++) await new Promise((r) => setTimeout(r, 100));

    const { raw, model } = await classifier.classify(Buffer.from('fake-image'), 'image/jpeg');
    assert.equal((raw as any).crop, 'Tomato');
    assert.match(model, /^openai:/);
    console.log('ok  diagnosis survives a Redis outage\n\n1 passed');
    process.exit(0);
})().catch((error) => {
    console.error('FAIL  diagnosis survives a Redis outage:', error?.message || error);
    process.exit(1);
});
