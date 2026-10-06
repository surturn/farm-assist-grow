import type { Decision } from './abstention';

export type Band = 'confident' | 'ask' | 'uncertain' | 'rejected';
export type RejectReason = 'unsupported' | 'not_plant' | 'unreadable';

/**
 * Bands sit on top of decide(), which stays the single source of the
 * abstention numbers (mirrored in Python). Only the two "close call"
 * reasons can be resolved by asking the farmer; a confused crop cannot.
 */
export function bandFor(decision: Decision, questionAvailable: boolean):
    { band: Exclude<Band, 'rejected'> } | { band: 'rejected'; reason: RejectReason } {
    switch (decision.reason) {
        case 'answered':
            return { band: 'confident' };
        case 'low_confidence':
        case 'healthy_ambiguous':
            return { band: questionAvailable ? 'ask' : 'uncertain' };
        case 'crop_not_supported':
            return { band: 'rejected', reason: 'unsupported' };
        default:
            return { band: 'uncertain' };
    }
}
