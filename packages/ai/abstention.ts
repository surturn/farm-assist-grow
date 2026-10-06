/**
 * Abstention policy: when the answer must be "not sure" (sipati uhakika).
 * Exact mirror of AImodel/pipeline/abstention.py; both are tested against
 * abstention-cases.json so the numbers evaluated offline are the behaviour
 * farmers get. See that file for the rule order and its known limits.
 */
import { ClassManifest, cropOf, diseaseOf } from './manifest';

export type AbstainReason =
    | 'answered'
    | 'no_prediction'
    | 'crop_not_supported'
    | 'unknown_crop'
    | 'crop_mismatch'
    | 'low_confidence'
    | 'healthy_ambiguous';

export interface Decision {
    answer: string | null;
    reason: AbstainReason;
    confidence: number;
    crop: string | null;
}

export const decide = (
    probs: Record<string, number>,
    manifest: ClassManifest,
    declaredCrop: string | null = null,
): Decision => {
    const labels = Object.keys(probs);
    if (labels.length === 0) return { answer: null, reason: 'no_prediction', confidence: 0, crop: null };

    const topLabel = labels.reduce((a, b) => (probs[b] > probs[a] ? b : a));
    const topP = probs[topLabel];

    const cropMass: Record<string, number> = {};
    for (const l of labels) cropMass[cropOf(l)] = (cropMass[cropOf(l)] ?? 0) + probs[l];
    const topCrop = Object.keys(cropMass).reduce((a, b) => (cropMass[b] > cropMass[a] ? b : a));
    const { minConfidence, minCropMass, healthyGuard } = manifest.abstention;
    const abstain = (reason: AbstainReason): Decision => ({ answer: null, reason, confidence: topP, crop: topCrop });

    if (declaredCrop !== null) {
        if (manifest.notTrained.crops.includes(declaredCrop)) return abstain('crop_not_supported');
        if (!manifest.trainedCrops.includes(declaredCrop)) return abstain('unknown_crop');
    }
    if (cropMass[topCrop] < minCropMass) return abstain('unknown_crop');
    if (declaredCrop !== null && declaredCrop !== topCrop) return abstain('crop_mismatch');
    if (topP < minConfidence) return abstain('low_confidence');
    if (diseaseOf(topLabel) !== 'Healthy' && (probs[`${cropOf(topLabel)}___Healthy`] ?? 0) >= healthyGuard) {
        return abstain('healthy_ambiguous');
    }
    return { answer: topLabel, reason: 'answered', confidence: topP, crop: topCrop };
};
