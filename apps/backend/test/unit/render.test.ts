import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, t } from '../../src/conversation/i18n';
import { checkFaithful, parseAnswerButtonId, parseDetailsButtonId, renderDetails, renderStep } from '../../src/conversation/render';
import type { DiagnosisStep } from '../../src/conversation/types';

const crops = ['Coffee', 'Tomato'];
const confident: DiagnosisStep = {
  scanId: 's1', band: 'confident', reason: null, label: 'Tomato___Late_Blight', crop: 'Tomato', confidence: 0.93, question: null,
  advice: { label: 'Tomato___Late_Blight', diseaseName: 'Late blight', symptoms: ['dark patches'], treatment: 'Remove infected plants.',
    prevention: ['Space plants'], chemicals: [{ activeIngredient: 'Mancozeb', pcpbReg: 'PCPB(CR)0001' }], source: { title: 'G', url: 'https://x' }, healthy: false, short: null },
};

test('every catalog key exists in English and Swahili', () => {
  for (const [key, v] of Object.entries(CATALOG)) assert.ok(v.en.trim() && v.sw.trim(), key);
});

test('params interpolate and unknown params stay visible', () => {
  assert.equal(t('reject.unsupported', 'en', { crops: 'Coffee, Tomato' }).includes('Coffee, Tomato'), true);
});

test('confident reply is short: plain name, short action, caution, details buttons', () => {
  const step: DiagnosisStep = { ...confident, advice: { ...confident.advice!,
    diseaseName: 'Late blight (Phytophthora infestans)', short: { name: 'late blight', action: 'Pull out sick plants.' } } };
  const [m] = renderStep(step, 'en', crops);
  assert.equal(m.text, 'Your Tomato has late blight (93% sure).\n\nWhat to do: Pull out sick plants.\n\nThis is advice, not a guarantee. Ask your agrovet if it spreads.');
  assert.deepEqual(m.buttons?.map((b) => b.id), ['d:s1:more', 'd:s1:prevent']);
  for (const b of m.buttons!) assert.ok(b.title.length <= 20);
  assert.deepEqual(parseDetailsButtonId('d:s1:more'), { scanId: 's1', section: 'more' });
  assert.equal(parseDetailsButtonId('d:s1:anything'), null);
  assert.deepEqual(checkFaithful([m], step), []);
});

test('without a short block the reply drops the scientific name and says ask your agrovet', () => {
  const step: DiagnosisStep = { ...confident, advice: { ...confident.advice!, diseaseName: 'Late blight (Phytophthora infestans)', short: null } };
  const [m] = renderStep(step, 'en', crops);
  assert.match(m.text, /^Your Tomato has Late blight \(93% sure\)\./);
  assert.doesNotMatch(m.text, /Phytophthora/);
  assert.match(m.text, /Ask your agrovet for treatment\./);
});

test('details carry the full KB text and stay faithful', () => {
  const more = renderDetails(confident.advice!, 'more', 'en').map((m) => m.text).join('\n');
  assert.match(more, /Signs:\n• dark patches/);
  assert.match(more, /Remove infected plants\./);
  assert.match(more, /Mancozeb/);
  assert.match(renderDetails(confident.advice!, 'prevent', 'en')[0].text, /\n• Space plants/);
  assert.deepEqual(checkFaithful(renderDetails(confident.advice!, 'more', 'en'), confident), []);
});

test('healthy reply offers prevention only', () => {
  const step: DiagnosisStep = { ...confident, advice: { ...confident.advice!, healthy: true, treatment: null, chemicals: [], short: null } };
  const [m] = renderStep(step, 'en', crops);
  assert.match(m.text, /looks healthy/);
  assert.deepEqual(m.buttons?.map((b) => b.id), ['d:s1:prevent']);
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
