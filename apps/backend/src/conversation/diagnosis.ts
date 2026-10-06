import { decide } from '@farmassist/ai/abstention';
import { getAdvice, type Lang } from '@farmassist/ai/advice';
import { checkClassifierOutput } from '@farmassist/ai/checker';
import { applyAnswer, nextQuestion, pairFor, type QuestionPair } from '@farmassist/ai/questions';
import { bandFor } from '@farmassist/ai/rules';
import {
  DuplicateMessageError, StaleAnswerError, type DiagnosisDeps, type DiagnosisStep, type Owner, type QuestionView,
  type ScanOriginInput, type ScanWrite, type TraceEntry,
} from './types';

export const QUESTION_CAP = 2;

const top2 = (probs: Record<string, number>) => Object.entries(probs).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([l]) => l);

function questionView(q: QuestionPair['questions'][number], lang: Lang): QuestionView {
  return { id: q.id, text: q.text[lang], options: q.options.map((o) => ({ id: o.id, text: o.text[lang] })) };
}

/** Shared by the first look and every answer: probs → band → step + scan fields. */
function resolve(deps: DiagnosisDeps, scanId: string, probs: Record<string, number>, crop: string,
  asked: string[], lang: Lang, trace: TraceEntry[]): { step: DiagnosisStep; write: Omit<ScanWrite, 'trace'> } {
  const decision = decide(probs, deps.manifest);
  const [a, b] = top2(probs);
  const pair = a && b ? pairFor(a, b, deps.questions) : null;
  const next = pair && asked.length < QUESTION_CAP ? nextQuestion(pair, asked) : null;
  const banded = bandFor(decision, next !== null);
  const confidence = decision.confidence;
  const base = { scanId, crop, confidence, label: null, advice: null, question: null, reason: null } as DiagnosisStep;

  if (banded.band === 'confident' && decision.answer) {
    const advice = getAdvice(decision.answer, lang, deps.knowledge);
    trace.push({ tool: 'get_advice', out: { label: decision.answer, sourced: advice.source !== null } });
    return {
      step: { ...base, band: 'confident', label: decision.answer, advice },
      write: { diseaseName: deps.knowledge[decision.answer].diseaseName, confidence: confidence * 100, reviewStatus: null },
    };
  }
  if (banded.band === 'ask' && next) {
    trace.push({ tool: 'ask_farmer', out: { questionId: next.id } });
    return { step: { ...base, band: 'ask', question: questionView(next, lang) }, write: { diseaseName: 'Not sure', confidence: confidence * 100, reviewStatus: null } };
  }
  if (banded.band === 'rejected') {
    return { step: { ...base, band: 'rejected', reason: banded.reason }, write: { diseaseName: 'Unsupported crop', confidence: null, reviewStatus: null } };
  }
  trace.push({ tool: 'flag_for_review', out: { reason: decision.reason } });
  return { step: { ...base, band: 'uncertain' }, write: { diseaseName: 'Not sure', confidence: confidence * 100, reviewStatus: 'PENDING' } };
}

export async function startDiagnosis(deps: DiagnosisDeps, origin: ScanOriginInput,
  image: { bytes: Buffer; mimeType: string }, lang: Lang): Promise<DiagnosisStep> {
  // A replayed delivery must never re-diagnose or reset the scan it already made.
  if (origin.waMessageId && await deps.findScanByMessage(origin.waMessageId)) throw new DuplicateMessageError(origin.waMessageId);
  const imageUrl = await deps.saveImage(image.bytes, image.mimeType);
  const { raw, model } = await deps.classify(image.bytes, image.mimeType);
  const checked = checkClassifierOutput(raw, deps.manifest);
  const trace: TraceEntry[] = [{ tool: 'classify_image', out: checked.ok ? checked.value : { error: checked.error } }];

  const rejected = (reason: 'unreadable' | 'unsupported' | 'not_plant', diseaseName: string, crop: string | null) =>
    deps.createScan(origin, { imageUrl, model, analysis: { raw }, diseaseName, confidence: null, trace, reviewStatus: null })
      .then(({ id, created }): DiagnosisStep => {
        if (!created) throw new DuplicateMessageError(origin.waMessageId ?? id);
        return { scanId: id, band: 'rejected', reason, label: null, crop, confidence: 0, advice: null, question: null };
      });

  if (!checked.ok) return rejected('unreadable', 'Unreadable photo', null);
  if (checked.value.kind === 'not_plant') return rejected('not_plant', 'Not a plant', null);
  if (checked.value.kind === 'unsupported') return rejected('unsupported', 'Unsupported crop', checked.value.crop);

  const { crop, probs } = checked.value;
  const { id, created } = await deps.createScan(origin, { imageUrl, model, analysis: { raw, crop, probs }, diseaseName: 'Not sure', confidence: null, answers: [], trace, reviewStatus: null });
  if (!created) throw new DuplicateMessageError(origin.waMessageId ?? id);
  const { step, write } = resolve(deps, id, probs, crop, [], lang, trace);
  await deps.updateScan(id, { ...write, imageUrl, model, analysis: { raw, crop, probs, pendingQuestion: step.question?.id ?? null }, answers: [], trace });
  return step;
}

export async function answerQuestion(deps: DiagnosisDeps, owner: Owner, scanId: string,
  questionId: string, optionId: string, lang: Lang): Promise<DiagnosisStep> {
  const scan = await deps.getScan(scanId);
  const owns = scan && ((owner.userId && scan.userId === owner.userId) || (owner.channelId && scan.channelId === owner.channelId));
  if (!scan || !owns || !scan.probs || !scan.crop || scan.verifiedLabel) throw new StaleAnswerError('no pending question');

  // Only the question this scan last showed may be answered: a replayed,
  // skipped-ahead or post-resolution tap is stale.
  if (scan.pendingQuestion !== questionId) throw new StaleAnswerError('not the pending question');
  const [a, b] = top2(scan.probs);
  const pair = a && b ? pairFor(a, b, deps.questions) : null;
  const expected = pair?.questions.find((q) => q.id === questionId);
  if (!pair || !expected) throw new StaleAnswerError('question no longer applies');
  const option = expected.options.find((o) => o.id === optionId);
  if (!option) throw new StaleAnswerError('unknown option');

  const probs = applyAnswer(scan.probs, pair, option);
  const answers = [...scan.answers, { questionId, optionId }];
  const trace = [...scan.trace, { tool: 'answer', out: { questionId, optionId } }];
  const { step, write } = resolve(deps, scanId, probs, scan.crop, answers.map((x) => x.questionId), lang, trace);
  await deps.updateScan(scanId, { ...write, analysis: { crop: scan.crop, probs, pendingQuestion: step.question?.id ?? null }, answers, trace });
  return step;
}
