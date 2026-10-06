import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAdvice } from '@farmassist/ai/advice';
import type { KnowledgeEntry } from '@farmassist/ai/manifest';

const base: KnowledgeEntry = {
  diseaseName: 'Late blight', cropType: 'Tomato', symptoms: ['dark patches'], possibleCauses: [],
  treatment: 'Remove infected plants.', prevention: ['Space plants'], reviewed: false,
  source: null, chemicals: [], sw: null,
};
const sourced: KnowledgeEntry = {
  ...base, source: { title: 'Guide', url: 'https://example.org' },
  chemicals: [{ activeIngredient: 'Mancozeb', pcpbReg: 'PCPB(CR)0001' }],
  sw: { diseaseName: 'Baa chelewa', symptoms: ['mabaka meusi'], treatment: 'Ondoa mimea iliyoathirika.', prevention: ['Panda kwa nafasi'] },
};
const healthy: KnowledgeEntry = { ...sourced, diseaseName: 'Healthy', chemicals: [], treatment: 'No treatment needed.' };

test('unsourced entry gives name and symptoms only', () => {
  const a = getAdvice('Tomato___Late_Blight', 'en', { Tomato___Late_Blight: base });
  assert.equal(a.diseaseName, 'Late blight');
  assert.deepEqual(a.symptoms, ['dark patches']);
  assert.equal(a.treatment, null);
  assert.deepEqual(a.prevention, []);
  assert.deepEqual(a.chemicals, []);
});

test('sourced entry gives treatment, prevention and registered chemicals', () => {
  const a = getAdvice('Tomato___Late_Blight', 'en', { Tomato___Late_Blight: sourced });
  assert.equal(a.treatment, 'Remove infected plants.');
  assert.deepEqual(a.chemicals, [{ activeIngredient: 'Mancozeb', pcpbReg: 'PCPB(CR)0001' }]);
  assert.equal(a.source?.url, 'https://example.org');
});

test('Swahili comes from the sw block', () => {
  const a = getAdvice('Tomato___Late_Blight', 'sw', { Tomato___Late_Blight: sourced });
  assert.equal(a.diseaseName, 'Baa chelewa');
  assert.equal(a.treatment, 'Ondoa mimea iliyoathirika.');
});

test('Healthy never carries treatment or chemicals', () => {
  const a = getAdvice('Tomato___Healthy', 'en', { Tomato___Healthy: healthy });
  assert.equal(a.healthy, true);
  assert.equal(a.treatment, null);
  assert.deepEqual(a.chemicals, []);
});

test('unknown label throws (manifest/KB drift is a bug, not a reply)', () => {
  assert.throws(() => getAdvice('Tomato___Wilt', 'en', {}));
});
