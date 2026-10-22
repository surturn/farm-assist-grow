/**
 * Class manifest + knowledge table, and the boot-time check that they match.
 *
 * class-manifest.json is the single source of truth for the classifier's
 * labels (shared with AImodel/pipeline). crop-knowledge.json must hold exactly
 * one entry per class: a missing entry would crash a farmer's scan at lookup,
 * an extra one means a stale class (e.g. maize) is still live. Either fails
 * the boot, not the scan.
 */
import fs from 'fs';
import path from 'path';

export interface ClassManifest {
    version: string;
    frozen: boolean;
    excludedCrops: string[];
    excludedTokens: string[];
    trainedCrops: string[];
    classes: string[];
    notTrained: { crops: string[]; labels: string[] };
    abstention: { calibrated: boolean; minConfidence: number; minCropMass: number; healthyGuard: number };
}

export interface KnowledgeSource { title: string; url: string }
export interface Chemical { activeIngredient: string; pcpbReg: string }
/** The farmer's first reply: plain name and one or two plain sentences of action. */
export interface KnowledgeShort { name: string; action: string }
export interface KnowledgeTranslation { diseaseName: string; symptoms: string[]; treatment: string; prevention: string[]; short?: KnowledgeShort }
export interface KnowledgeEntry {
    diseaseName: string; cropType: string; symptoms: string[]; possibleCauses: string[];
    treatment: string; prevention: string[]; reviewed: boolean;
    source: KnowledgeSource | null; chemicals: Chemical[]; sw: KnowledgeTranslation | null;
    short?: KnowledgeShort;
}

const KNOWLEDGE_FIELDS = ['diseaseName', 'cropType', 'symptoms', 'possibleCauses', 'treatment', 'prevention', 'reviewed', 'source', 'chemicals', 'sw'];

// Kept identical to DOSAGE_RE in AImodel/pipeline/manifest.py.
const DOSAGE_RE =
    /\d+(\.\d+)?\s*(ml|mls|millilit|l\b|lit|g\b|gm|gram|kg|cc|%|oz|tbsp|tsp|ppm)|per\s+(litre|liter|acre|hectare|ha\b|knapsack|20\s*l)|\bkg\/ha\b|\bl\/ha\b/i;

export const cropOf = (label: string) => label.split('___')[0];
export const diseaseOf = (label: string) => label.split('___')[1];

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf-8'));

export const loadClassManifest = (): ClassManifest => readJson<ClassManifest>('class-manifest.json');
export const loadKnowledge = (): Record<string, KnowledgeEntry> => readJson('crop-knowledge.json');

export const checkManifestAndKnowledge = (
    manifest: ClassManifest,
    knowledge: Record<string, unknown>,
): string[] => {
    const errors: string[] = [];
    const classes = new Set(manifest.classes);
    const tokens = manifest.excludedTokens.map((t) => t.toLowerCase());

    if (!manifest.frozen) errors.push('class manifest is not frozen');
    for (const c of manifest.classes) {
        if (tokens.some((t) => c.toLowerCase().includes(t))) errors.push(`excluded crop in class list: ${c}`);
    }
    for (const crop of manifest.trainedCrops) {
        if (!classes.has(`${crop}___Healthy`)) errors.push(`crop ${crop} has no Healthy class`);
    }
    for (const c of manifest.classes) {
        if (!(c in knowledge)) errors.push(`knowledge missing class ${c}`);
    }
    for (const key of Object.keys(knowledge)) {
        if (!classes.has(key)) errors.push(`knowledge has entry for non-class ${key}`);
    }
    for (const c of manifest.classes) {
        const entry = knowledge[c] as Record<string, unknown> | undefined;
        if (!entry) continue;
        for (const f of KNOWLEDGE_FIELDS) if (!(f in entry)) errors.push(`${c}: missing field ${f}`);
        if (entry.cropType !== cropOf(c)) errors.push(`${c}: cropType ${String(entry.cropType)} != ${cropOf(c)}`);
        if ('severity' in entry) errors.push(`${c}: severity must not be stored (model does not assess it)`);
        const e = entry as unknown as KnowledgeEntry;
        const text = JSON.stringify([e.symptoms, e.possibleCauses, e.treatment, e.prevention, e.sw, e.chemicals, e.short]);
        const m = DOSAGE_RE.exec(text);
        if (m) errors.push(`${c}: looks like a dosage (${m[0]}); defer quantities to extension services`);
        const chemicals = Array.isArray(e.chemicals) ? e.chemicals : [];
        if (e.source) {
            if (!e.source.title?.trim()) errors.push(`${c}: source needs a title`);
            if (!/^https:\/\//.test(e.source.url ?? '')) errors.push(`${c}: source url must be https`);
            const sw = e.sw;
            if (!sw || !sw.diseaseName?.trim() || !Array.isArray(sw.symptoms) || typeof sw.treatment !== 'string' || !Array.isArray(sw.prevention)) {
                errors.push(`${c}: sourced entry needs a Swahili translation`);
            }
            const shortOk = (s: KnowledgeShort | undefined) => !!s?.name?.trim() && !!s?.action?.trim();
            if (diseaseOf(c) !== 'Healthy' && (!shortOk(e.short) || !shortOk(sw?.short))) {
                errors.push(`${c}: sourced entry needs a short name and action in English and Swahili`);
            }
        } else if (chemicals.length > 0) {
            errors.push(`${c}: chemicals need a source`);
        }
        if (diseaseOf(c) === 'Healthy' && chemicals.length > 0) errors.push(`${c}: Healthy entry may not list chemicals`);
        for (const chem of chemicals) {
            if (!chem.activeIngredient?.trim()) errors.push(`${c}: chemical without an active ingredient`);
            if (!chem.pcpbReg?.trim()) errors.push(`${c}: chemical ${chem.activeIngredient} has no PCPB registration`);
        }
    }
    return errors;
};

/** Throws at startup if the class list and knowledge table disagree. */
export const assertKnowledgeMatchesManifest = (): ClassManifest => {
    const manifest = loadClassManifest();
    const errors = checkManifestAndKnowledge(manifest, loadKnowledge());
    if (errors.length) {
        throw new Error(`crop knowledge / class manifest mismatch (${manifest.version}):\n  ${errors.join('\n  ')}`);
    }
    return manifest;
};
