import type { Lang } from '@farmassist/ai/advice';
import { t } from './i18n';
import type { DiagnosisStep, OutboundMessage } from './types';

export const answerButtonId = (scanId: string, questionId: string, optionId: string) => `a:${scanId}:${questionId}:${optionId}`;

export function parseAnswerButtonId(id: string): { scanId: string; questionId: string; optionId: string } | null {
  const m = /^a:([\w-]{1,64}):([\w-]{1,32}):([\w-]{1,32})$/.exec(id);
  return m ? { scanId: m[1], questionId: m[2], optionId: m[3] } : null;
}

const join = (xs: string[]) => xs.join('; ');

export function renderStep(step: DiagnosisStep, lang: Lang, supportedCrops: string[]): OutboundMessage[] {
  if (step.band === 'rejected') {
    const key = step.reason === 'unsupported' ? 'reject.unsupported' : step.reason === 'not_plant' ? 'reject.not_plant' : 'reject.unreadable';
    return [{ text: t(key, lang, { crops: supportedCrops.join(', ') }) }];
  }
  if (step.band === 'uncertain') return [{ text: t('diagnosis.uncertain', lang) }];
  if (step.band === 'ask' && step.question) {
    return [{
      text: t('question.intro', lang, { question: step.question.text }),
      buttons: step.question.options.slice(0, 3).map((o) => ({ id: answerButtonId(step.scanId, step.question!.id, o.id), title: o.text })),
    }];
  }
  const a = step.advice!;
  const lines: string[] = [];
  if (a.healthy) {
    lines.push(t('diagnosis.healthy', lang, { crop: step.crop ?? '' }));
  } else {
    lines.push(t('diagnosis.result', lang, { disease: a.diseaseName, crop: step.crop ?? '', confidence: String(Math.round(step.confidence * 100)) }));
    if (a.symptoms.length) lines.push(t('diagnosis.symptoms', lang, { list: join(a.symptoms) }));
    if (a.treatment) lines.push(t('diagnosis.treatment', lang, { text: a.treatment }));
    if (a.chemicals.length) lines.push(t('diagnosis.chemicals', lang, { list: a.chemicals.map((c) => c.activeIngredient).join(', ') }));
    if (!a.treatment && !a.chemicals.length) lines.push(t('diagnosis.no_advice', lang));
  }
  if (a.prevention.length) lines.push(t('diagnosis.prevention', lang, { list: join(a.prevention) }));
  lines.push(t('diagnosis.footer', lang));
  return [{ text: lines.join('\n\n') }];
}

// ponytail: Phase A check is a fixed vocabulary scan; Phase B replaces it with an
// observation-grounded check over free agent text.
const CHEMICAL_WORDS = /\b(mancozeb|chlorothalonil|copper|metalaxyl|azoxystrobin|imidacloprid|lambda|cyhalothrin|abamectin|carbendazim|propiconazole|thiophanate|difenoconazole|sulphur|sulfur)\b/gi;

/** Every chemical a reply names must come from this step's advice. */
export function checkFaithful(messages: OutboundMessage[], step: DiagnosisStep): string[] {
  const allowed = new Set((step.advice?.chemicals ?? []).flatMap((c) => c.activeIngredient.toLowerCase().split(/[\s,+/-]+/)));
  const violations: string[] = [];
  for (const m of messages) {
    for (const word of m.text.match(CHEMICAL_WORDS) ?? []) {
      if (!allowed.has(word.toLowerCase())) violations.push(`unsourced chemical: ${word}`);
    }
  }
  return violations;
}
