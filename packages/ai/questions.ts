import fs from 'fs';
import path from 'path';
import { cropOf } from './manifest';

export interface LocalText { en: string; sw: string }
export interface QuestionOption { id: string; text: LocalText; favours: string | null; weight: number }
export interface Question { id: string; text: LocalText; options: QuestionOption[] }
export interface QuestionPair { labels: [string, string]; source: { title: string; url: string } | null; questions: Question[] }

export const loadQuestions = (): QuestionPair[] =>
    JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf-8')).pairs;

/** Only pairs with a cited source may be asked (provenance gate). */
export function pairFor(a: string, b: string, pairs: QuestionPair[]): QuestionPair | null {
    return pairs.find((p) => p.source && p.labels.includes(a) && p.labels.includes(b) && a !== b) ?? null;
}

export function nextQuestion(pair: QuestionPair, askedIds: string[]): Question | null {
    return pair.questions.find((q) => !askedIds.includes(q.id)) ?? null;
}

/**
 * Bayesian-style re-weighting inside the pair: the option's weight is the
 * likelihood it gives the favoured label (1 - weight to the other). Mass
 * outside the pair is untouched, and the pair keeps its total.
 */
export function applyAnswer(probs: Record<string, number>, pair: QuestionPair, option: QuestionOption): Record<string, number> {
    if (!option.favours) return { ...probs };
    const [a, b] = option.favours === pair.labels[0] ? pair.labels : [pair.labels[1], pair.labels[0]];
    const pA = probs[a] ?? 0;
    const pB = probs[b] ?? 0;
    const mass = pA + pB;
    if (mass === 0) return { ...probs };
    const wA = pA * option.weight;
    const wB = pB * (1 - option.weight);
    return { ...probs, [a]: (mass * wA) / (wA + wB), [b]: (mass * wB) / (wA + wB) };
}

const BUTTON_MAX = 20; // WhatsApp reply-button title limit

export function checkQuestions(pairs: QuestionPair[], classes: string[]): string[] {
    const errors: string[] = [];
    const seen = new Set<string>();
    for (const p of pairs) {
        const name = p.labels.join('|');
        const key = [...p.labels].sort().join('|');
        if (seen.has(key)) errors.push(`${name}: duplicate pair`);
        seen.add(key);
        for (const l of p.labels) if (!classes.includes(l)) errors.push(`${name}: unknown label ${l}`);
        if (cropOf(p.labels[0]) !== cropOf(p.labels[1])) errors.push(`${name}: labels from different crops`);
        if (p.source && !/^https:\/\//.test(p.source.url)) errors.push(`${name}: source url must be https`);
        if (p.questions.length === 0 || p.questions.length > 2) errors.push(`${name}: needs 1-2 questions`);
        const qIds = new Set<string>();
        for (const q of p.questions) {
            if (qIds.has(q.id)) errors.push(`${name}/${q.id}: duplicate question id`);
            qIds.add(q.id);
            if (!q.text.en?.trim() || !q.text.sw?.trim()) errors.push(`${name}/${q.id}: question needs en and sw`);
            if (q.options.length < 2 || q.options.length > 3) errors.push(`${name}/${q.id}: needs 2-3 options`);
            for (const o of q.options) {
                for (const lang of ['en', 'sw'] as const) {
                    const t = o.text[lang] ?? '';
                    if (!t.trim()) errors.push(`${name}/${q.id}/${o.id}: missing ${lang} text`);
                    if (t.length > BUTTON_MAX) errors.push(`${name}/${q.id}/${o.id}: ${lang} text longer than ${BUTTON_MAX}`);
                }
                if (!(o.weight > 0 && o.weight < 1)) errors.push(`${name}/${q.id}/${o.id}: weight must be between 0 and 1`);
                if (o.favours !== null && !p.labels.includes(o.favours)) errors.push(`${name}/${q.id}/${o.id}: favours a label outside its pair`);
            }
        }
    }
    return errors;
}
