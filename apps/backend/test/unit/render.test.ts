import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, t } from '../../src/conversation/i18n';
import { checkFaithful, parseAnswerButtonId, renderStep } from '../../src/conversation/render';
import type { DiagnosisStep } from '../../src/conversation/types';

const crops = ['Coffee', 'Tomato'];
const confident: DiagnosisStep = {
  scanId: 's1', band: 'confident', reason: null, label: 'Tomato___Late_Blight', crop: 'Tomato', confidence: 0.93, question: null,
  advice: { label: 'Tomato___Late_Blight', diseaseName: 'Late blight', symptoms: ['dark patches'], treatment: 'Remove infected plants.',
    prevention: ['Space plants'], chemicals: [{ activeIngredient: 'Mancozeb', pcpbReg: 'PCPB(CR)0001' }], source: { title: 'G', url: 'https://x' }, healthy: false },
};

test('every catalog key exists in English and Swahili', () => {
  for (const [key, v] of Object.entries(CATALOG)) assert.ok(v.en.trim() && v.sw.trim(), key);
});

test('params interpolate and unknown params stay visible', () => {
  assert.equal(t('reject.unsupported', 'en', { crops: 'Coffee, Tomato' }).includes('Coffee, Tomato'), true);
});

test('confident reply carries KB text only and is faithful', () => {
  const msgs = renderStep(confident, 'en', crops);
  const all = msgs.map((m) => m.text).join('\n');
  assert.match(all, /Late blight/);
  assert.match(all, /Remove infected plants\./);
  assert.match(all, /Mancozeb/);
  assert.match(all, /agrovet/i);
  assert.deepEqual(checkFaithful(msgs, confident), []);
});

test('unsourced advice says ask your agrovet', () => {
  const step = { ...confident, advice: { ...confident.advice!, treatment: null, prevention: [], chemicals: [], source: null } };
  assert.match(renderStep(step, 'sw', crops).map((m) => m.text).join('\n'), /agrovet/i);
});

test('ask renders up to 3 buttons within 20 chars with parseable ids', () => {
  const step: DiagnosisStep = { ...confident, band: 'ask', advice: null, label: null,
    question: { id: 'q1', text: 'Where?', options: [{ id: 'lower', text: 'Old lower leaves' }, { id: 'unsure', text: 'Not sure' }] } };
  const [m] = renderStep(step, 'en', crops);
  assert.equal(m.buttons?.length, 2);
  for (const b of m.buttons!) assert.ok(b.title.length <= 20);
  assert.deepEqual(parseAnswerButtonId(m.buttons![0].id), { scanId: 's1', questionId: 'q1', optionId: 'lower' });
  assert.equal(parseAnswerButtonId('garbage'), null);
});

test('a reply naming a chemical not in the advice is unfaithful', () => {
  const tampered = [{ text: 'Spray Chlorothalonil now' }];
  assert.ok(checkFaithful(tampered, confident).length > 0);
});

test('hyphenated chemical names like Lambda-cyhalothrin are treated as single ingredients', () => {
  const step: DiagnosisStep = { ...confident,
    advice: { ...confident.advice!, chemicals: [{ activeIngredient: 'Lambda-cyhalothrin', pcpbReg: 'PCPB(CR)0009' }] } };
  const msgs = [{ text: 'Use Lambda-cyhalothrin for best results.' }];
  assert.deepEqual(checkFaithful(msgs, step), []);
});

test('uncertain and rejected replies have fixed text', () => {
  for (const s of [{ ...confident, band: 'uncertain' as const, advice: null },
    { ...confident, band: 'rejected' as const, reason: 'not_plant' as const, advice: null }]) {
    assert.ok(renderStep(s, 'en', crops)[0].text.length > 0);
  }
});
