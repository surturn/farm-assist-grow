import { z } from 'zod';
import { cropOf, type ClassManifest } from './manifest';

const Raw = z.object({
    crop: z.string(),
    predictions: z.array(z.object({ label: z.string(), score: z.number().min(0).max(1) })).max(5),
});

export type CheckedOutput =
    | { kind: 'plant'; crop: string; probs: Record<string, number> }
    | { kind: 'unsupported'; crop: string }
    | { kind: 'not_plant' };

/**
 * The first guardrail after the model: anything outside the closed label
 * list, or any shape we did not ask for, is rejected rather than repaired.
 */
export function checkClassifierOutput(raw: unknown, manifest: ClassManifest): { ok: true; value: CheckedOutput } | { ok: false; error: string } {
    const parsed = Raw.safeParse(raw);
    if (!parsed.success) return { ok: false, error: 'schema' };
    const { crop, predictions } = parsed.data;

    if (crop === 'NotAPlant') return { ok: true, value: { kind: 'not_plant' } };
    if (!manifest.trainedCrops.includes(crop)) return { ok: true, value: { kind: 'unsupported', crop } };
    if (predictions.length === 0) return { ok: false, error: 'no predictions for a trained crop' };

    const probs: Record<string, number> = {};
    for (const p of predictions) {
        if (!manifest.classes.includes(p.label)) return { ok: false, error: `unknown label ${p.label}` };
        if (cropOf(p.label) !== crop) return { ok: false, error: `label ${p.label} is not ${crop}` };
        if (p.label in probs) return { ok: false, error: `duplicate label ${p.label}` };
        probs[p.label] = p.score;
    }
    const total = Object.values(probs).reduce((a, b) => a + b, 0);
    if (total > 1.05) return { ok: false, error: 'scores sum past 1' };
    return { ok: true, value: { kind: 'plant', crop, probs } };
}
