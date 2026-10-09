import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadClassManifest } from '@farmassist/ai/manifest';
import { checkClassifierOutput } from '@farmassist/ai/checker';

const m = loadClassManifest();

test('valid plant output becomes a probability map', () => {
  const r = checkClassifierOutput({ crop: 'Tomato', predictions: [
    { label: 'Tomato___Early_Blight', score: 0.7 }, { label: 'Tomato___Late_Blight', score: 0.2 },
  ] }, m);
  assert.deepEqual(r, { ok: true, value: { kind: 'plant', crop: 'Tomato', probs: { Tomato___Early_Blight: 0.7, Tomato___Late_Blight: 0.2 } } });
});

test('Unsupported and NotAPlant are explicit kinds', () => {
  assert.deepEqual(checkClassifierOutput({ crop: 'Unsupported', predictions: [] }, m), { ok: true, value: { kind: 'unsupported', crop: 'Unsupported' } });
  assert.deepEqual(checkClassifierOutput({ crop: 'NotAPlant', predictions: [] }, m), { ok: true, value: { kind: 'not_plant' } });
});

for (const [name, raw] of [
  ['malformed', 'not json'],
  ['missing predictions', { crop: 'Tomato' }],
  ['unknown label', { crop: 'Tomato', predictions: [{ label: 'Tomato___Wilt', score: 0.9 }] }],
  ['label from another crop', { crop: 'Tomato', predictions: [{ label: 'Potato___Late_Blight', score: 0.9 }] }],
  ['score out of range', { crop: 'Tomato', predictions: [{ label: 'Tomato___Early_Blight', score: 1.4 }] }],
  ['scores sum past 1', { crop: 'Tomato', predictions: [{ label: 'Tomato___Early_Blight', score: 0.8 }, { label: 'Tomato___Late_Blight', score: 0.8 }] }],
  ['trained crop with no predictions', { crop: 'Tomato', predictions: [] }],
  ['duplicate label', { crop: 'Tomato', predictions: [{ label: 'Tomato___Early_Blight', score: 0.4 }, { label: 'Tomato___Early_Blight', score: 0.4 }] }],
] as const) {
  test(`rejects ${name}`, () => assert.equal(checkClassifierOutput(raw, m).ok, false));
}
