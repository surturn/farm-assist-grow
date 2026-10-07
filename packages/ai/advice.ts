import { diseaseOf, type Chemical, type KnowledgeEntry, type KnowledgeShort, type KnowledgeSource } from './manifest';

export type Lang = 'en' | 'sw';

export interface AdviceView {
    label: string;
    diseaseName: string;
    symptoms: string[];
    treatment: string | null;
    prevention: string[];
    chemicals: Chemical[];
    source: KnowledgeSource | null;
    healthy: boolean;
    /** Plain name, and an action only when sourced; the short reply falls back to diseaseName. */
    short: { name: string; action: string | null } | null;
}

/**
 * The only path from the knowledge base to a farmer. Name and symptoms
 * describe; they are always sent. Anything that tells the farmer to act
 * needs a cited source, and Healthy never gets treatment.
 */
export function getAdvice(label: string, lang: Lang, knowledge: Record<string, KnowledgeEntry>): AdviceView {
    const e = knowledge[label];
    if (!e) throw new Error(`no knowledge entry for ${label}`);
    const healthy = diseaseOf(label) === 'Healthy';
    const t = lang === 'sw' && e.sw ? e.sw : e;
    const sourced = e.source !== null;
    return {
        label,
        diseaseName: t.diseaseName,
        symptoms: t.symptoms,
        treatment: sourced && !healthy && t.treatment ? t.treatment : null,
        prevention: sourced ? t.prevention : [],
        chemicals: sourced && !healthy ? e.chemicals.filter((c) => c.pcpbReg.trim()) : [],
        source: e.source,
        healthy,
        short: shortView(lang === 'sw' ? e.sw?.short : e.short, sourced && !healthy),
    };
}

const shortView = (s: KnowledgeShort | undefined, mayAct: boolean) => (s ? { name: s.name, action: mayAct ? s.action : null } : null);
