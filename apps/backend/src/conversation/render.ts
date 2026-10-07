import type { AdviceView, Lang } from '@farmassist/ai/advice';
import { t } from './i18n';
import type { DiagnosisStep, OutboundMessage } from './types';

export const answerButtonId = (scanId: string, questionId: string, optionId: string) => `a:${scanId}:${questionId}:${optionId}`;

export function parseAnswerButtonId(id: string): { scanId: string; questionId: string; optionId: string } | null {
  const m = /^a:([\w-]{1,64}):([\w-]{1,32}):([\w-]{1,32})$/.exec(id);
  return m ? { scanId: m[1], questionId: m[2], optionId: m[3] } : null;
}

export type DetailSection = 'more' | 'prevent';
export const detailsButtonId = (scanId: string, section: DetailSection) => `d:${scanId}:${section}`;

export function parseDetailsButtonId(id: string): { scanId: string; section: DetailSection } | null {
  const m = /^d:([\w-]{1,64}):(more|prevent)$/.exec(id);
  return m ? { scanId: m[1], section: m[2] as DetailSection } : null;
}

const bullets = (xs: string[]) => xs.map((x) => `\n• ${x}`).join('');
/** "Late blight (Phytophthora infestans)" -> "Late blight", for entries without a short name. */
const plainName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '');

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
  // Short first: a plain name, one or two sentences of action and the caution.
  // Everything else sits behind the details buttons (renderDetails).
  const a = step.advice!;
  const lines: string[] = [];
  if (a.healthy) {
    lines.push(t('diagnosis.healthy', lang, { crop: step.crop ?? '' }));
  } else {
    const name = a.short?.name ?? plainName(a.diseaseName);
    lines.push(t('diagnosis.short', lang, { crop: step.crop ?? '', name, confidence: String(Math.round(step.confidence * 100)) }));
    lines.push(a.short?.action ? t('diagnosis.treatment', lang, { text: a.short.action }) : t('diagnosis.no_advice', lang));
    lines.push(t('diagnosis.footer', lang));
  }
  const buttons = [
    ...(a.healthy ? [] : [{ id: detailsButtonId(step.scanId, 'more'), title: t('button.details', lang) }]),
    ...(a.prevention.length ? [{ id: detailsButtonId(step.scanId, 'prevent'), title: t('button.prevent', lang) }] : []),
  ];
  return [{ text: lines.join('\n\n'), ...(buttons.length ? { buttons } : {}) }];
}

/** The full advice behind a details button. Same KB text as before, one section per tap. */
export function renderDetails(a: AdviceView, section: DetailSection, lang: Lang): OutboundMessage[] {
  if (section === 'prevent') return [{ text: t('diagnosis.prevention', lang, { list: bullets(a.prevention) }) }];
  const lines = [a.diseaseName];
  if (a.symptoms.length) lines.push(t('diagnosis.symptoms', lang, { list: bullets(a.symptoms) }));
  if (a.treatment) lines.push(t('diagnosis.treatment', lang, { text: a.treatment }));
  if (a.chemicals.length) lines.push(t('diagnosis.chemicals', lang, { list: a.chemicals.map((c) => c.activeIngredient).join(', ') }));
  if (!a.treatment && !a.chemicals.length) lines.push(t('diagnosis.no_advice', lang));
  return [{ text: lines.join('\n\n') }];
}

// ponytail: Phase A check is a fixed vocabulary scan; Phase B replaces it with an
// observation-grounded check over free agent text.
const CHEMICAL_WORDS = /\b(mancozeb|chlorothalonil|copper|metalaxyl|azoxystrobin|imidacloprid|lambda|cyhalothrin|abamectin|carbendazim|propiconazole|thiophanate|difenoconazole|sulphur|sulfur)\b/gi;

/** Every chemical a reply names must come from this step's advice. */
export function checkFaithful(messages: OutboundMessage[], step: Pick<DiagnosisStep, 'advice'>): string[] {
  const allowed = new Set((step.advice?.chemicals ?? []).flatMap((c) => c.activeIngredient.toLowerCase().split(/[\s,+/-]+/)));
  const violations: string[] = [];
  for (const m of messages) {
    for (const word of m.text.match(CHEMICAL_WORDS) ?? []) {
      if (!allowed.has(word.toLowerCase())) violations.push(`unsourced chemical: ${word}`);
    }
  }
  return violations;
}
