import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandFor } from '@farmassist/ai/rules';
import type { AbstainReason } from '@farmassist/ai/abstention';

const d = (reason: AbstainReason) => ({ answer: reason === 'answered' ? 'Tomato___Early_Blight' : null, reason, confidence: 0.5, crop: 'Tomato' });

test('answered is confident', () => assert.deepEqual(bandFor(d('answered'), false), { band: 'confident' }));
test('low confidence asks when a question exists', () => assert.deepEqual(bandFor(d('low_confidence'), true), { band: 'ask' }));
test('low confidence without a question is uncertain', () => assert.deepEqual(bandFor(d('low_confidence'), false), { band: 'uncertain' }));
test('healthy ambiguity asks when a question exists', () => assert.deepEqual(bandFor(d('healthy_ambiguous'), true), { band: 'ask' }));
test('untrained crop is rejected as unsupported', () => assert.deepEqual(bandFor(d('crop_not_supported'), true), { band: 'rejected', reason: 'unsupported' }));
for (const r of ['unknown_crop', 'crop_mismatch', 'no_prediction'] as const) {
  test(`${r} is uncertain, never asked`, () => assert.deepEqual(bandFor(d(r), true), { band: 'uncertain' }));
}
