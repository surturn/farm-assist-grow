import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadClassManifest, loadKnowledge } from '@farmassist/ai/manifest';
import type { QuestionPair } from '@farmassist/ai/questions';
import { answerQuestion, startDiagnosis } from '../../src/conversation/diagnosis';
import { StaleAnswerError, type DiagnosisDeps, type ScanState, type ScanWrite } from '../../src/conversation/types';

const pair: QuestionPair = {
  labels: ['Tomato___Early_Blight', 'Tomato___Late_Blight'],
  source: { title: 't', url: 'https://example.org' },
  questions: [
    { id: 'q1', text: { en: 'Where?', sw: 'Wapi?' }, options: [
      { id: 'lower', text: { en: 'Lower', sw: 'Chini' }, favours: 'Tomato___Early_Blight', weight: 0.9 },
      { id: 'unsure', text: { en: 'Not sure', sw: 'Sijui' }, favours: null, weight: 0.5 },
    ] },
    { id: 'q2', text: { en: 'Weather?', sw: 'Hewa?' }, options: [
      { id: 'dry', text: { en: 'Dry', sw: 'Kavu' }, favours: 'Tomato___Early_Blight', weight: 0.9 },
      { id: 'unsure', text: { en: 'Not sure', sw: 'Sijui' }, favours: null, weight: 0.5 },
    ] },
  ],
};

function fakeDeps(raw: unknown) {
  const scans = new Map<string, ScanState & { write: ScanWrite }>();
  let n = 0;
  const deps: DiagnosisDeps = {
    manifest: loadClassManifest(),
    knowledge: loadKnowledge(),
    questions: [pair],
    classify: async () => ({ raw, model: 'fake@1' }),
    saveImage: async () => 'scans/x.jpg',
    createScan: async (origin, data) => {
      const id = `s${++n}`;
      const a = data.analysis as any;
      scans.set(id, { id, userId: origin.userId ?? null, channelId: origin.channelId ?? null, verifiedLabel: null,
        probs: a?.probs ?? null, crop: a?.crop ?? null, answers: data.answers ?? [], pendingQuestion: a?.pendingQuestion ?? null, trace: data.trace, write: data });
      return { id };
    },
    getScan: async (id) => scans.get(id) ?? null,
    updateScan: async (id, data) => {
      const s = scans.get(id)!;
      const a = data.analysis as any;
      scans.set(id, { ...s, probs: a?.probs ?? s.probs, answers: data.answers ?? s.answers, pendingQuestion: a && 'pendingQuestion' in a ? a.pendingQuestion : s.pendingQuestion, trace: data.trace, write: data });
    },
  };
  return { deps, scans };
}

const img = { bytes: Buffer.from('x'), mimeType: 'image/jpeg' };
const confidentRaw = { crop: 'Tomato', predictions: [{ label: 'Tomato___Late_Blight', score: 0.97 }, { label: 'Tomato___Healthy', score: 0.01 }] };
const closeRaw = { crop: 'Tomato', predictions: [{ label: 'Tomato___Early_Blight', score: 0.55 }, { label: 'Tomato___Late_Blight', score: 0.4 }] };

test('confident: advice from the KB, scan captured with model and trace', async () => {
  const { deps, scans } = fakeDeps(confidentRaw);
  const step = await startDiagnosis(deps, { userId: 'u1' }, img, 'en');
  assert.equal(step.band, 'confident');
  assert.equal(step.label, 'Tomato___Late_Blight');
  assert.equal(step.advice?.diseaseName, loadKnowledge()['Tomato___Late_Blight'].diseaseName);
  const s = scans.get(step.scanId)!;
  assert.equal(s.write.imageUrl, 'scans/x.jpg');
  assert.equal(s.write.model, 'fake@1');
  assert.ok(s.write.trace.some((t) => t.tool === 'classify_image'));
  assert.ok(s.write.trace.some((t) => t.tool === 'get_advice'));
});

test('close call with a sourced pair asks the first question', async () => {
  const { deps } = fakeDeps(closeRaw);
  const step = await startDiagnosis(deps, { userId: 'u1' }, img, 'sw');
  assert.equal(step.band, 'ask');
  assert.equal(step.question?.id, 'q1');
  assert.equal(step.question?.text, 'Wapi?');
});

test('answers resolve to confident within the cap', async () => {
  const { deps } = fakeDeps(closeRaw);
  const s1 = await startDiagnosis(deps, { userId: 'u1' }, img, 'en');
  const s2 = await answerQuestion(deps, { userId: 'u1' }, s1.scanId, 'q1', 'lower', 'en');
  assert.equal(s2.band, 'confident');
  assert.equal(s2.label, 'Tomato___Early_Blight');
});

test('two "not sure" answers end uncertain and flag for review', async () => {
  const { deps, scans } = fakeDeps(closeRaw);
  const s1 = await startDiagnosis(deps, { userId: 'u1' }, img, 'en');
  const s2 = await answerQuestion(deps, { userId: 'u1' }, s1.scanId, 'q1', 'unsure', 'en');
  assert.equal(s2.band, 'ask');
  const s3 = await answerQuestion(deps, { userId: 'u1' }, s1.scanId, 'q2', 'unsure', 'en');
  assert.equal(s3.band, 'uncertain');
  assert.equal(scans.get(s1.scanId)!.write.reviewStatus, 'PENDING');
  assert.equal(scans.get(s1.scanId)!.write.diseaseName, 'Not sure');
});

test('stale, replayed, foreign and unknown answers are rejected', async () => {
  const { deps } = fakeDeps(closeRaw);
  const s1 = await startDiagnosis(deps, { userId: 'u1' }, img, 'en');
  await assert.rejects(answerQuestion(deps, { userId: 'u1' }, s1.scanId, 'q2', 'dry', 'en'), StaleAnswerError); // not the next question
  await assert.rejects(answerQuestion(deps, { userId: 'u2' }, s1.scanId, 'q1', 'lower', 'en'), StaleAnswerError); // someone else's scan
  await assert.rejects(answerQuestion(deps, { userId: 'u1' }, s1.scanId, 'q1', 'nope', 'en'), StaleAnswerError); // unknown option
  await answerQuestion(deps, { userId: 'u1' }, s1.scanId, 'q1', 'lower', 'en');
  await assert.rejects(answerQuestion(deps, { userId: 'u1' }, s1.scanId, 'q1', 'lower', 'en'), StaleAnswerError); // replay after resolving
  await assert.rejects(answerQuestion(deps, { userId: 'u1' }, 'missing', 'q1', 'lower', 'en'), StaleAnswerError);
});

test('checker failure is rejected/unreadable, still captured', async () => {
  const { deps, scans } = fakeDeps({ crop: 'Tomato', predictions: [{ label: 'Potato___Late_Blight', score: 0.9 }] });
  const step = await startDiagnosis(deps, { userId: 'u1' }, img, 'en');
  assert.deepEqual([step.band, step.reason], ['rejected', 'unreadable']);
  assert.equal(scans.get(step.scanId)!.write.model, 'fake@1');
});

test('unsupported crop and not-a-plant are rejected with their reasons', async () => {
  for (const [raw, reason] of [[{ crop: 'Unsupported', predictions: [] }, 'unsupported'], [{ crop: 'NotAPlant', predictions: [] }, 'not_plant']] as const) {
    const { deps } = fakeDeps(raw);
    const step = await startDiagnosis(deps, { userId: 'u1' }, img, 'en');
    assert.deepEqual([step.band, step.reason], ['rejected', reason]);
  }
});

test('close call with no sourced pair is uncertain, not asked', async () => {
  const { deps } = fakeDeps(closeRaw);
  deps.questions = [{ ...pair, source: null }];
  const step = await startDiagnosis(deps, { userId: 'u1' }, img, 'en');
  assert.equal(step.band, 'uncertain');
});
