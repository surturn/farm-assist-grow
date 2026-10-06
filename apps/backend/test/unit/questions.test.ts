import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadClassManifest } from '@farmassist/ai/manifest';
import { applyAnswer, checkQuestions, loadQuestions, nextQuestion, pairFor, type QuestionPair } from '@farmassist/ai/questions';

const classes = loadClassManifest().classes;
const pair: QuestionPair = {
  labels: ['Tomato___Early_Blight', 'Tomato___Late_Blight'],
  source: { title: 't', url: 'https://example.org' },
  questions: [
    { id: 'q1', text: { en: 'Q1?', sw: 'S1?' }, options: [
      { id: 'a', text: { en: 'A', sw: 'A' }, favours: 'Tomato___Early_Blight', weight: 0.8 },
      { id: 'n', text: { en: 'Not sure', sw: 'Sijui' }, favours: null, weight: 0.5 },
    ] },
    { id: 'q2', text: { en: 'Q2?', sw: 'S2?' }, options: [
      { id: 'b', text: { en: 'B', sw: 'B' }, favours: 'Tomato___Late_Blight', weight: 0.7 },
    ] },
  ],
};

test('real question bank passes its integrity check', () => {
  assert.deepEqual(checkQuestions(loadQuestions(), classes), []);
});

test('pairFor is order-insensitive and ignores unsourced pairs', () => {
  assert.equal(pairFor('Tomato___Late_Blight', 'Tomato___Early_Blight', [pair]), pair);
  assert.equal(pairFor('Tomato___Late_Blight', 'Tomato___Early_Blight', [{ ...pair, source: null }]), null);
});

test('nextQuestion walks the list and stops', () => {
  assert.equal(nextQuestion(pair, [])?.id, 'q1');
  assert.equal(nextQuestion(pair, ['q1'])?.id, 'q2');
  assert.equal(nextQuestion(pair, ['q1', 'q2']), null);
});

test('an answer shifts mass inside the pair and keeps the pair total', () => {
  const probs = { Tomato___Early_Blight: 0.5, Tomato___Late_Blight: 0.4, Tomato___Healthy: 0.1 };
  const out = applyAnswer(probs, pair, pair.questions[0].options[0]);
  assert.ok(out.Tomato___Early_Blight > 0.5);
  assert.ok(Math.abs(out.Tomato___Early_Blight + out.Tomato___Late_Blight - 0.9) < 1e-9);
  assert.equal(out.Tomato___Healthy, 0.1);
});

test('"not sure" leaves probabilities unchanged', () => {
  const probs = { Tomato___Early_Blight: 0.5, Tomato___Late_Blight: 0.4 };
  assert.deepEqual(applyAnswer(probs, pair, pair.questions[0].options[1]), probs);
});

test('integrity check catches long button text, bad weights and foreign labels', () => {
  const bad: QuestionPair = JSON.parse(JSON.stringify(pair));
  bad.questions[0].options[0].text.sw = 'Hii ni ndefu kupita kiasi kabisa';
  bad.questions[0].options[0].weight = 1;
  bad.questions[1].options[0].favours = 'Potato___Late_Blight';
  const errs = checkQuestions([bad], classes).join('\n');
  assert.match(errs, /longer than 20/);
  assert.match(errs, /weight must be between 0 and 1/);
  assert.match(errs, /favours a label outside its pair/);
});
