# Diagnosis Pipeline (Plan 2A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Farmers send a crop photo on WhatsApp, or upload one on the dashboard, and get one of four replies: a diagnosis with advice drawn only from the cited knowledge base; one or two tap-to-answer questions and then a diagnosis; an honest "not sure, an expert will check"; or a clear refusal. Every reply is produced by one shared, unit-tested pipeline.

**Architecture:** Both surfaces call one channel-neutral core, `apps/backend/src/conversation/diagnosis.ts`. The core runs five steps:
1. **Classifier** (`packages/ai/classifier.ts`, OpenAI for now). Returns ranked labels from the closed list in `class-manifest.json`.
2. **Output checker** (`packages/ai/checker.ts`). Validates that output.
3. **Abstention** (`decide()`, already in `packages/ai/abstention.ts`) plus a **band mapper** (`packages/ai/rules.ts`). Together they turn the checked output into confident / ask / uncertain / rejected.
4. **Question bank** (`packages/ai/questions.json`). Used for the "ask" band.
5. **Advice gate** (`packages/ai/advice.ts`). Pulls text only from sourced entries in `crop-knowledge.json`.

Each surface has a thin adapter. The WhatsApp worker renders the core's output into text and reply-button messages and sends them through the Graph API. The REST API returns the same output to the dashboard. Conversation state lives on the Scan row, and a question button's id carries the scan id, so no separate session store is needed.

**Tech Stack:** Express 5, Prisma 7 (Postgres), BullMQ and ioredis, sharp, zod, OpenAI Chat Completions (json_schema output), React 18 + Vite, node:test via tsx.

**Spec:** `docs/superpowers/specs/2026-10-06-conversational-diagnosis-core-design.md` (Phase A: §3, §4, §6 and delivery steps 2–5). The eval harness (§5) is Plan 2B. Telegram (step 7), the ReAct agent (step 8) and training (step 9) are later plans.

**Base:** `main` with `ui/dashboard-redesign` merged. Merge that PR before Task 1.

## Deviations from the spec (approved at plan review)

| Spec says | This plan does | Why |
|---|---|---|
| §3.2: rename `waMessageId` to `externalMessageId`; `FarmerChannel` gets `channel` + `externalId` | Only adds `Scan.answers` and `Scan.trace`; renames are deferred to the Telegram plan | WhatsApp is the only channel until Telegram lands. The rename touches every channel service and test and buys nothing until then. The core's `InboundMessage` is already channel-neutral in code. |
| §3.4: pending question held in Redis `conv:<channelId>` with 24h TTL | State lives on the Scan row (`analysis.probs`, `answers`), and button ids carry `scanId` | No second store and no expiry edge cases. The dashboard and WhatsApp share one code path. A forged or stale button is rejected by checking it against the Scan. |
| §3.5/§3.3: after answers, `classify_image(image, answers)` re-runs the classifier | Answers re-score the stored probabilities with per-option weights from `questions.json` | Deterministic, unit-testable and free. It works unchanged for the local CNN, which cannot read text. The weights are reviewable data. |
| §4.4: chemical items carry the dose "as published" | Chemical items carry `activeIngredient` + `pcpbReg` only; no dose anywhere | The existing knowledge gate (`DOSAGE_RE`, TS and Python) already forbids doses, deliberately. Farmers get the dose from the product label or the agrovet. |
| §4.4: `reviewed` renamed `agronomistReviewed` (date) | Keeps `reviewed: boolean` | Renaming touches the Python tests and buys nothing. It still gates nothing. |

## Global Constraints

- The class list is `packages/ai/class-manifest.json` (30 classes, 6 crops). No other file may hard-code labels or crops.
- The model only classifies. Every farmer-facing word of advice (treatment, prevention, chemicals) comes from `crop-knowledge.json`. A reply never contains model-written advice.
- **Provenance gate.**
  - Disease name and symptoms are always sendable.
  - Treatment and prevention are sent only when the entry has `source`.
  - A chemical is sent only when the entry has `source` and the item has `pcpbReg`.
  - A Healthy label never carries treatment or chemicals.
- No dose may appear anywhere in the KB, in either language (`DOSAGE_RE`).
- At most 2 questions per scan. Questions come only from `questions.json`, and only for pairs whose `source` is set.
- The model never sees raw farmer text. Button replies are mapped to curated option ids.
- Thresholds stay in `class-manifest.json` → `abstention` (uncalibrated placeholders, never loosened before Plan 2B calibrates them).
- WhatsApp reply-button titles are at most 20 characters, with at most 3 buttons per message. A free-form message is sent only inside the 24-hour service window (`isServiceWindowOpen`).
- Images: decodable, shortest side ≥ 224 px, at most 10 MB.
- Every diagnosis writes a training example (image, raw model output, model id) through `scanService`. Rejected and uncertain scans are captured too.
- Unit tests run with no network, DB or Redis (`npm run test:unit`). All dependencies are injected.
- Commit messages carry no AI attribution lines.

## Review Focus

- **A farmer taps an old question button after a newer photo, or taps the same button twice.** Expected: "That question has expired. Send the photo again.", with no change to the scan. Pinned in Task 7 (`answerQuestion` rejects a question that is not the next one) and Task 10 (button replayed).
- **A button id crafted for someone else's scan.** Expected: treated as stale, with nothing revealed and nothing changed. Pinned in Task 7 (owner check) and Task 11 (REST 404).
- **The classifier returns a label from another crop, an unknown label, or malformed JSON.** Expected: band `rejected` with reason `unreadable`, the photo still captured, and a "couldn't read that photo" reply. Pinned in Task 4 (checker) and Task 7.
- **A sourced KB entry whose Swahili translation is missing, and a Swahili-speaking farmer.** Expected: the build fails on the integrity test, so this cannot ship. Pinned in Task 2.
- **WhatsApp media larger than 10 MB, or a sticker or video sent as the "photo".** Expected: a polite "couldn't read that photo" reply, no download of oversized media, and no model call. Pinned in Task 9 (`downloadMedia` size check) and Task 10.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `apps/backend/prisma/schema.prisma` | add `Scan.answers Json?`, `Scan.trace Json?` | 1 |
| `apps/backend/package.json` | `test:unit` script | 1 |
| `packages/ai/manifest.ts`, `AImodel/pipeline/manifest.py` | knowledge fields `source`, `chemicals`, `sw`; dose check across all text | 2 |
| `packages/ai/crop-knowledge.json` | migrated entries | 2, 13 |
| `packages/ai/questions.json`, `packages/ai/questions.ts` | question bank, pair lookup, answer re-scoring | 3 |
| `packages/ai/checker.ts` | validate classifier output against the manifest, build probs | 4 |
| `packages/ai/classifier.ts` | OpenAI classifier (json_schema), cached | 4 |
| `packages/ai/rules.ts` | `decide()` reason → band | 5 |
| `packages/ai/advice.ts` | provenance-gated advice view | 6 |
| `apps/backend/src/conversation/types.ts` | `DiagnosisStep`, `OutboundMessage`, deps types | 7 |
| `apps/backend/src/conversation/diagnosis.ts` | `startDiagnosis`, `answerQuestion` | 7 |
| `apps/backend/src/conversation/deps.ts` | real dependency wiring (DB, storage, classifier) | 7 |
| `apps/backend/src/conversation/i18n.ts` | en/sw message catalog | 8 |
| `apps/backend/src/conversation/render.ts` | `DiagnosisStep` → `OutboundMessage[]`, faithfulness check | 8 |
| `apps/backend/src/conversation/filter.ts` | image checks | 9 |
| `apps/backend/src/channels/whatsapp/graph.ts` | Graph API calls: send, media download | 9 |
| `apps/backend/src/channels/whatsapp/sender.ts` | window check, send, record outbound events | 9 |
| `apps/backend/src/channels/whatsapp/intent.router.ts`, `types.ts` | button replies | 9 |
| `apps/backend/src/channels/whatsapp/conversation.ts` | intent → core → send | 10 |
| `apps/backend/src/channels/whatsapp/inbound.worker.ts` | call the conversation handler | 10 |
| `apps/backend/src/controllers/scan.controller.ts`, `routes/scan.routes.ts` | REST on the core; answer endpoint | 11 |
| `apps/backend/src/controllers/dashboard.controller.ts` | awaiting count excludes "Not sure" | 11 |
| `apps/frontend/src/...` | scan result, question flow, status | 12 |
| `apps/backend/test/unit/*.test.ts` | unit tests | 1–10 |

---

### Task 1: Branch, additive schema, unit-test runner

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Modify: `apps/backend/package.json`
- Create: `apps/backend/test/unit/smoke.test.ts`

**Interfaces:**
- Produces: `Scan.answers Json?` (array of `{ questionId: string; optionId: string }`), `Scan.trace Json?` (array of `{ tool: string; out: unknown }`), `npm run test:unit`.

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull --ff-only
git checkout -b feat/diagnosis-pipeline
```

- [ ] **Step 2: Add the runner and a smoke test**

In `apps/backend/package.json` `scripts`, add:

```json
"test:unit": "tsx --test \"test/unit/**/*.test.ts\""
```

Create `apps/backend/test/unit/smoke.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadClassManifest } from '@farmassist/ai/manifest';

test('unit runner loads the class manifest without network or DB', () => {
  assert.equal(loadClassManifest().classes.length, 30);
});
```

Run: `npm run test:unit --workspace=backend`
Expected: `# pass 1`.

- [ ] **Step 3: Schema**

In `model Scan`, after `verifiedBy String?`, add:

```prisma
  // Conversation state and audit trail (diagnosis pipeline). answers holds
  // [{questionId, optionId}] in the order asked; trace holds the tool steps.
  answers       Json?
  trace         Json?
```

Run:
```bash
cd apps/backend && npx prisma db push && npx prisma generate && npx tsc --noEmit
```
Expected: "in sync", and tsc is clean. The change is additive, so no data loss.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/package.json apps/backend/test
git commit -m "chore: add Scan answers/trace columns and a unit test runner"
```

---

### Task 2: Knowledge base fields for provenance and Swahili

**Files:**
- Modify: `packages/ai/manifest.ts`
- Modify: `AImodel/pipeline/manifest.py`
- Modify: `packages/ai/crop-knowledge.json`
- Create: `apps/backend/test/unit/knowledge.test.ts`

**Interfaces:**
- Produces (in `packages/ai/manifest.ts`):

```ts
export interface KnowledgeSource { title: string; url: string }
export interface Chemical { activeIngredient: string; pcpbReg: string }
export interface KnowledgeTranslation { diseaseName: string; symptoms: string[]; treatment: string; prevention: string[] }
export interface KnowledgeEntry {
    diseaseName: string; cropType: string; symptoms: string[]; possibleCauses: string[];
    treatment: string; prevention: string[]; reviewed: boolean;
    source: KnowledgeSource | null; chemicals: Chemical[]; sw: KnowledgeTranslation | null;
}
```

- [ ] **Step 1: Write the failing integrity test**

Create `apps/backend/test/unit/knowledge.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkManifestAndKnowledge, loadClassManifest, loadKnowledge } from '@farmassist/ai/manifest';

const manifest = loadClassManifest();
const fresh = () => JSON.parse(JSON.stringify(loadKnowledge()));

test('real knowledge table passes the gate', () => {
  assert.deepEqual(checkManifestAndKnowledge(manifest, loadKnowledge()), []);
});

test('every entry has source, chemicals and sw fields', () => {
  for (const [label, e] of Object.entries(loadKnowledge())) {
    assert.ok('source' in e && 'chemicals' in e && 'sw' in e, label);
  }
});

test('a sourced entry without Swahili fails the build', () => {
  const k = fresh();
  k['Tomato___Late_Blight'].source = { title: 'X', url: 'https://example.org/x' };
  k['Tomato___Late_Blight'].sw = null;
  assert.match(checkManifestAndKnowledge(manifest, k).join('\n'), /Tomato___Late_Blight: sourced entry needs a Swahili translation/);
});

test('a chemical without a PCPB registration fails', () => {
  const k = fresh();
  const e = k['Tomato___Late_Blight'];
  e.source = { title: 'X', url: 'https://example.org/x' };
  e.sw = { diseaseName: 'a', symptoms: [], treatment: 'b', prevention: [] };
  e.chemicals = [{ activeIngredient: 'Mancozeb', pcpbReg: '' }];
  assert.match(checkManifestAndKnowledge(manifest, k).join('\n'), /chemical Mancozeb has no PCPB registration/);
});

test('chemicals on an unsourced entry fail', () => {
  const k = fresh();
  k['Tomato___Late_Blight'].chemicals = [{ activeIngredient: 'Mancozeb', pcpbReg: 'PCPB(CR)0001' }];
  assert.match(checkManifestAndKnowledge(manifest, k).join('\n'), /chemicals need a source/);
});

test('a Healthy entry may not list chemicals', () => {
  const k = fresh();
  const e = k['Tomato___Healthy'];
  e.source = { title: 'X', url: 'https://example.org/x' };
  e.sw = { diseaseName: 'a', symptoms: [], treatment: '', prevention: [] };
  e.chemicals = [{ activeIngredient: 'Copper', pcpbReg: 'PCPB(CR)0002' }];
  assert.match(checkManifestAndKnowledge(manifest, k).join('\n'), /Healthy entry may not list chemicals/);
});

test('a dose hidden in the Swahili text fails', () => {
  const k = fresh();
  const e = k['Tomato___Late_Blight'];
  e.source = { title: 'X', url: 'https://example.org/x' };
  e.sw = { diseaseName: 'a', symptoms: [], treatment: 'Nyunyiza 50 g kwa lita 20', prevention: [] };
  assert.match(checkManifestAndKnowledge(manifest, k).join('\n'), /looks like a dosage/);
});

test('a source URL must be https', () => {
  const k = fresh();
  const e = k['Tomato___Late_Blight'];
  e.source = { title: 'X', url: 'http://example.org/x' };
  e.sw = { diseaseName: 'a', symptoms: [], treatment: 'b', prevention: [] };
  assert.match(checkManifestAndKnowledge(manifest, k).join('\n'), /source url must be https/);
});
```

Run: `npm run test:unit --workspace=backend`
Expected: FAIL. The real table is missing the new fields, and the new rules are not implemented.

- [ ] **Step 2: Implement the TS gate**

In `packages/ai/manifest.ts`, replace the `KnowledgeEntry` interface with the Interfaces block above. Then:

```ts
const KNOWLEDGE_FIELDS = ['diseaseName', 'cropType', 'symptoms', 'possibleCauses', 'treatment', 'prevention', 'reviewed', 'source', 'chemicals', 'sw'];
```

Inside the per-class loop of `checkManifestAndKnowledge`, replace the two lines starting `const text = JSON.stringify(...)` with:

```ts
        const e = entry as unknown as KnowledgeEntry;
        const text = JSON.stringify([e.symptoms, e.possibleCauses, e.treatment, e.prevention, e.sw, e.chemicals]);
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
        } else if (chemicals.length > 0) {
            errors.push(`${c}: chemicals need a source`);
        }
        if (diseaseOf(c) === 'Healthy' && chemicals.length > 0) errors.push(`${c}: Healthy entry may not list chemicals`);
        for (const chem of chemicals) {
            if (!chem.activeIngredient?.trim()) errors.push(`${c}: chemical without an active ingredient`);
            if (!chem.pcpbReg?.trim()) errors.push(`${c}: chemical ${chem.activeIngredient} has no PCPB registration`);
        }
```

- [ ] **Step 3: Mirror it in Python**

In `AImodel/pipeline/manifest.py`:

```python
KNOWLEDGE_FIELDS = ("diseaseName", "cropType", "symptoms", "possibleCauses", "treatment", "prevention", "reviewed",
                    "source", "chemicals", "sw")
```

and in `check_knowledge`, change the dose-scan line to cover the new fields:

```python
        text = json.dumps({k: entry.get(k) for k in ("symptoms", "possibleCauses", "treatment", "prevention", "sw", "chemicals")})
```

The provenance rules live in TS only. Python reads the KB only to check that it stays in sync with the manifest, and the dose rule is mirrored because both pipelines must refuse a dose.

- [ ] **Step 4: Migrate the table**

```bash
python - <<'EOF'
import json
p = 'packages/ai/crop-knowledge.json'
k = json.load(open(p, encoding='utf-8'))
for e in k.values():
    e.setdefault('source', None)
    e.setdefault('chemicals', [])
    e.setdefault('sw', None)
open(p, 'w', encoding='utf-8').write(json.dumps(k, indent=2, ensure_ascii=False) + '\n')
EOF
```

Every entry is now unsourced, so the system sends disease name and symptoms only, and "ask your agrovet" for treatment. Task 13 sources the priority entries.

- [ ] **Step 5: Run both suites**

```bash
npm run test:unit --workspace=backend
npm run test:ai --workspace=backend
(cd AImodel && python -m unittest discover -s tests)
```
Expected: all pass. That is 8 knowledge tests plus the smoke test, the 15 AI tests, and the Python suite (33, 1 skipped).

- [ ] **Step 6: Commit**

```bash
git add packages/ai/manifest.ts packages/ai/crop-knowledge.json AImodel/pipeline/manifest.py apps/backend/test/unit/knowledge.test.ts
git commit -m "feat(ai): provenance and Swahili fields in the knowledge gate"
```

---

### Task 3: Question bank and answer re-scoring

**Files:**
- Create: `packages/ai/questions.json`
- Create: `packages/ai/questions.ts`
- Create: `apps/backend/test/unit/questions.test.ts`

**Interfaces:**
- Produces:

```ts
export interface LocalText { en: string; sw: string }
export interface QuestionOption { id: string; text: LocalText; favours: string | null; weight: number }
export interface Question { id: string; text: LocalText; options: QuestionOption[] }
export interface QuestionPair { labels: [string, string]; source: { title: string; url: string } | null; questions: Question[] }
export function loadQuestions(): QuestionPair[]
export function pairFor(a: string, b: string, pairs: QuestionPair[]): QuestionPair | null   // order-insensitive; only sourced pairs
export function nextQuestion(pair: QuestionPair, askedIds: string[]): Question | null
export function applyAnswer(probs: Record<string, number>, pair: QuestionPair, option: QuestionOption): Record<string, number>
export function checkQuestions(pairs: QuestionPair[], classes: string[]): string[]
```

- [ ] **Step 1: Write the failing test**

Create `apps/backend/test/unit/questions.test.ts`:

```ts
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
```

Run: `npm run test:unit --workspace=backend`
Expected: FAIL with "Cannot find module '@farmassist/ai/questions'".

- [ ] **Step 2: Implement `packages/ai/questions.ts`**

```ts
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
```

- [ ] **Step 3: Write `packages/ai/questions.json`**

The pairs are the three most-confused ones in the abstention cases. The question wording follows standard extension distinctions:
- Early blight starts on the oldest, lowest leaves and shows target-like rings.
- Late blight follows cool, wet weather and spreads fast, often on younger growth.
- Septoria shows many small spots with pale centres.

`source` stays `null` here. Task 13 sets each one after verifying the page. Until then `pairFor` returns null, so the band falls to `uncertain` instead of asking.

```json
{
  "notes": "Look-alike pairs and the questions that separate them. A pair is only asked once its source is set (provenance gate). weight = likelihood the option gives the favoured label. Button text max 20 chars.",
  "pairs": [
    {
      "labels": ["Tomato___Early_Blight", "Tomato___Late_Blight"],
      "source": null,
      "questions": [
        { "id": "spot_start", "text": { "en": "Where did the spots start?", "sw": "Madoa yalianza wapi?" },
          "options": [
            { "id": "lower", "text": { "en": "Old lower leaves", "sw": "Majani ya chini" }, "favours": "Tomato___Early_Blight", "weight": 0.8 },
            { "id": "upper", "text": { "en": "Young upper leaves", "sw": "Majani ya juu" }, "favours": "Tomato___Late_Blight", "weight": 0.7 },
            { "id": "unsure", "text": { "en": "Not sure", "sw": "Sijui" }, "favours": null, "weight": 0.5 }
          ] },
        { "id": "weather", "text": { "en": "What was the weather this past week?", "sw": "Hali ya hewa ilikuwaje wiki hii?" },
          "options": [
            { "id": "cool_wet", "text": { "en": "Cool and wet", "sw": "Baridi na mvua" }, "favours": "Tomato___Late_Blight", "weight": 0.75 },
            { "id": "warm_dry", "text": { "en": "Warm and dry", "sw": "Joto na ukavu" }, "favours": "Tomato___Early_Blight", "weight": 0.65 },
            { "id": "unsure", "text": { "en": "Not sure", "sw": "Sijui" }, "favours": null, "weight": 0.5 }
          ] }
      ]
    },
    {
      "labels": ["Potato___Early_Blight", "Potato___Late_Blight"],
      "source": null,
      "questions": [
        { "id": "spot_start", "text": { "en": "Where did the spots start?", "sw": "Madoa yalianza wapi?" },
          "options": [
            { "id": "lower", "text": { "en": "Old lower leaves", "sw": "Majani ya chini" }, "favours": "Potato___Early_Blight", "weight": 0.8 },
            { "id": "upper", "text": { "en": "Young upper leaves", "sw": "Majani ya juu" }, "favours": "Potato___Late_Blight", "weight": 0.7 },
            { "id": "unsure", "text": { "en": "Not sure", "sw": "Sijui" }, "favours": null, "weight": 0.5 }
          ] },
        { "id": "weather", "text": { "en": "What was the weather this past week?", "sw": "Hali ya hewa ilikuwaje wiki hii?" },
          "options": [
            { "id": "cool_wet", "text": { "en": "Cool and wet", "sw": "Baridi na mvua" }, "favours": "Potato___Late_Blight", "weight": 0.75 },
            { "id": "warm_dry", "text": { "en": "Warm and dry", "sw": "Joto na ukavu" }, "favours": "Potato___Early_Blight", "weight": 0.65 },
            { "id": "unsure", "text": { "en": "Not sure", "sw": "Sijui" }, "favours": null, "weight": 0.5 }
          ] }
      ]
    },
    {
      "labels": ["Tomato___Septoria_Leaf_Spot", "Tomato___Early_Blight"],
      "source": null,
      "questions": [
        { "id": "spot_look", "text": { "en": "What do the spots look like?", "sw": "Madoa yanaonekanaje?" },
          "options": [
            { "id": "small_pale", "text": { "en": "Many, pale centres", "sw": "Mengi, kati hafifu" }, "favours": "Tomato___Septoria_Leaf_Spot", "weight": 0.8 },
            { "id": "rings", "text": { "en": "Rings like a target", "sw": "Pete kama shabaha" }, "favours": "Tomato___Early_Blight", "weight": 0.8 },
            { "id": "unsure", "text": { "en": "Not sure", "sw": "Sijui" }, "favours": null, "weight": 0.5 }
          ] }
      ]
    }
  ]
}
```

Every option text above is within 20 characters; the integrity test enforces it.

- [ ] **Step 4: Run tests**

Run: `npm run test:unit --workspace=backend`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/ai/questions.ts packages/ai/questions.json apps/backend/test/unit/questions.test.ts
git commit -m "feat(ai): look-alike question bank with deterministic answer re-scoring"
```

---

### Task 4: Classifier output checker and OpenAI classifier

**Files:**
- Create: `packages/ai/checker.ts`
- Create: `packages/ai/classifier.ts`
- Modify: `packages/ai/package.json` (add `"zod": "^3.25.76"` to `dependencies`)
- Create: `apps/backend/test/unit/checker.test.ts`

**Interfaces:**
- Produces:

```ts
// checker.ts
export type CheckedOutput =
  | { kind: 'plant'; crop: string; probs: Record<string, number> }
  | { kind: 'unsupported'; crop: string }
  | { kind: 'not_plant' };
export function checkClassifierOutput(raw: unknown, manifest: ClassManifest): { ok: true; value: CheckedOutput } | { ok: false; error: string };
// classifier.ts
export interface ClassifierResult { raw: unknown; model: string }
export const classifier: { classify(image: Buffer, mimeType: string): Promise<ClassifierResult> };
```

- [ ] **Step 1: Write the failing test**

Create `apps/backend/test/unit/checker.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadClassManifest } from '@farmassist/ai/manifest';
import { checkClassifierOutput } from '@farmassist/ai/checker';

const m = loadClassManifest();

test('valid plant output becomes a probability map', () => {
  const r = checkClassifierOutput({ crop: 'Tomato', predictions: [
    { label: 'Tomato___Early_Blight', score: 0.7 }, { label: 'Tomato___Late_Blight', score: 0.2 },
  ] }, m);
  assert.deepEqual(r, { ok: true, value: { kind: 'plant', crop: 'Tomato', probs: { Tomato___Early_Blight: 0.7, Tomato___Late_Blight: 0.2 } } });
});

test('Unsupported and NotAPlant are explicit kinds', () => {
  assert.deepEqual(checkClassifierOutput({ crop: 'Unsupported', predictions: [] }, m), { ok: true, value: { kind: 'unsupported', crop: 'Unsupported' } });
  assert.deepEqual(checkClassifierOutput({ crop: 'NotAPlant', predictions: [] }, m), { ok: true, value: { kind: 'not_plant' } });
});

for (const [name, raw] of [
  ['malformed', 'not json'],
  ['missing predictions', { crop: 'Tomato' }],
  ['unknown label', { crop: 'Tomato', predictions: [{ label: 'Tomato___Wilt', score: 0.9 }] }],
  ['label from another crop', { crop: 'Tomato', predictions: [{ label: 'Potato___Late_Blight', score: 0.9 }] }],
  ['score out of range', { crop: 'Tomato', predictions: [{ label: 'Tomato___Early_Blight', score: 1.4 }] }],
  ['scores sum past 1', { crop: 'Tomato', predictions: [{ label: 'Tomato___Early_Blight', score: 0.8 }, { label: 'Tomato___Late_Blight', score: 0.8 }] }],
  ['trained crop with no predictions', { crop: 'Tomato', predictions: [] }],
  ['duplicate label', { crop: 'Tomato', predictions: [{ label: 'Tomato___Early_Blight', score: 0.4 }, { label: 'Tomato___Early_Blight', score: 0.4 }] }],
] as const) {
  test(`rejects ${name}`, () => assert.equal(checkClassifierOutput(raw, m).ok, false));
}
```

Run: `npm run test:unit --workspace=backend` → Expected: FAIL (module missing).

- [ ] **Step 2: Implement `packages/ai/checker.ts`**

```ts
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
```

- [ ] **Step 3: Implement `packages/ai/classifier.ts`**

```ts
import crypto from 'crypto';
import { redis } from '@farmassist/redis';
import { loadClassManifest } from './manifest';

export interface ClassifierResult { raw: unknown; model: string }

const manifest = loadClassManifest();
const CROPS = [...manifest.trainedCrops, 'Unsupported', 'NotAPlant'];

const SYSTEM_PROMPT = `You are a plant pathologist classifying a single crop photo.
Supported crops: ${manifest.trainedCrops.join(', ')}.
1. Identify the crop. If there is no plant, crop = "NotAPlant". If it is a plant but not a supported crop, crop = "Unsupported".
2. For a supported crop, return up to 3 labels from the allowed list for THAT crop only, with probability scores that sum to at most 1.
3. Base scores only on visible symptoms. Do not give advice. Return JSON only.`;

const SCHEMA = {
    name: 'crop_classification',
    strict: true,
    schema: {
        type: 'object',
        additionalProperties: false,
        required: ['crop', 'predictions'],
        properties: {
            crop: { type: 'string', enum: CROPS },
            predictions: {
                type: 'array',
                maxItems: 3,
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['label', 'score'],
                    properties: { label: { type: 'string', enum: manifest.classes }, score: { type: 'number' } },
                },
            },
        },
    },
};

const sha256 = (data: string | Buffer) => crypto.createHash('sha256').update(data).digest('hex');

/** Object so tests can replace classify, the same way they stub authAdmin. */
export const classifier = {
    classify: async (image: Buffer, mimeType: string): Promise<ClassifierResult> => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OpenAI API key missing');
        const aiModel = process.env.AI_MODEL || 'gpt-4o';
        const model = `openai:${aiModel}@${sha256(SYSTEM_PROMPT + manifest.version).slice(0, 8)}`;
        const cacheKey = `crop_classify:${model}:${sha256(image)}`;

        const cached = await redis.get(cacheKey).catch(() => null);
        if (cached) return { raw: JSON.parse(cached), model };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: aiModel,
                temperature: 0,
                max_tokens: 300,
                response_format: { type: 'json_schema', json_schema: SCHEMA },
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: [{ type: 'image_url', image_url: { url: `data:${mimeType};base64,${image.toString('base64')}`, detail: 'high' } }] },
                ],
            }),
        });
        if (!response.ok) throw new Error(`OpenAI API failed: ${response.status}`);
        const content = (await response.json()).choices?.[0]?.message?.content;
        if (!content) throw new Error('No content returned from OpenAI');
        // Parse only; validation is the checker's job, so a malformed answer
        // is still captured as a training example.
        let raw: unknown;
        try { raw = JSON.parse(content); } catch { raw = content; }
        await redis.setex(cacheKey, 604800, JSON.stringify(raw)).catch(() => undefined);
        return { raw, model };
    },
};
```

- [ ] **Step 4: Run tests, typecheck**

```bash
npm install --no-audit --no-fund
npm run test:unit --workspace=backend
(cd apps/backend && npx tsc --noEmit)
```
Expected: all pass; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add packages/ai/checker.ts packages/ai/classifier.ts packages/ai/package.json package-lock.json apps/backend/test/unit/checker.test.ts
git commit -m "feat(ai): closed-label classifier and output checker"
```

---

### Task 5: Bands

**Files:**
- Create: `packages/ai/rules.ts`
- Create: `apps/backend/test/unit/rules.test.ts`

**Interfaces:**
- Consumes: `Decision`, `AbstainReason` from `packages/ai/abstention.ts`.
- Produces:

```ts
export type Band = 'confident' | 'ask' | 'uncertain' | 'rejected';
export type RejectReason = 'unsupported' | 'not_plant' | 'unreadable';
export function bandFor(decision: Decision, questionAvailable: boolean): { band: Exclude<Band, 'rejected'> } | { band: 'rejected'; reason: RejectReason };
```

- [ ] **Step 1: Failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandFor } from '@farmassist/ai/rules';
import type { AbstainReason } from '@farmassist/ai/abstention';

const d = (reason: AbstainReason) => ({ answer: reason === 'answered' ? 'Tomato___Early_Blight' : null, reason, confidence: 0.5, crop: 'Tomato' });

test('answered is confident', () => assert.deepEqual(bandFor(d('answered'), false), { band: 'confident' }));
test('low confidence asks when a question exists', () => assert.deepEqual(bandFor(d('low_confidence'), true), { band: 'ask' }));
test('low confidence without a question is uncertain', () => assert.deepEqual(bandFor(d('low_confidence'), false), { band: 'uncertain' }));
test('healthy ambiguity asks when a question exists', () => assert.deepEqual(bandFor(d('healthy_ambiguous'), true), { band: 'ask' }));
test('untrained crop is rejected as unsupported', () => assert.deepEqual(bandFor(d('crop_not_supported'), true), { band: 'rejected', reason: 'unsupported' }));
for (const r of ['unknown_crop', 'crop_mismatch', 'no_prediction'] as const) {
  test(`${r} is uncertain, never asked`, () => assert.deepEqual(bandFor(d(r), true), { band: 'uncertain' }));
}
```

Save as `apps/backend/test/unit/rules.test.ts`. Run it. Expected: FAIL (module missing).

- [ ] **Step 2: Implement `packages/ai/rules.ts`**

```ts
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
```

- [ ] **Step 3: Run, commit**

```bash
npm run test:unit --workspace=backend
git add packages/ai/rules.ts apps/backend/test/unit/rules.test.ts
git commit -m "feat(ai): map abstention reasons to reply bands"
```

---

### Task 6: Provenance-gated advice

**Files:**
- Create: `packages/ai/advice.ts`
- Create: `apps/backend/test/unit/advice.test.ts`

**Interfaces:**
- Produces:

```ts
export type Lang = 'en' | 'sw';
export interface AdviceView {
  label: string; diseaseName: string; symptoms: string[];
  treatment: string | null; prevention: string[]; chemicals: Chemical[];
  source: KnowledgeSource | null; healthy: boolean;
}
export function getAdvice(label: string, lang: Lang, knowledge: Record<string, KnowledgeEntry>): AdviceView;
```

- [ ] **Step 1: Failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAdvice } from '@farmassist/ai/advice';
import type { KnowledgeEntry } from '@farmassist/ai/manifest';

const base: KnowledgeEntry = {
  diseaseName: 'Late blight', cropType: 'Tomato', symptoms: ['dark patches'], possibleCauses: [],
  treatment: 'Remove infected plants.', prevention: ['Space plants'], reviewed: false,
  source: null, chemicals: [], sw: null,
};
const sourced: KnowledgeEntry = {
  ...base, source: { title: 'Guide', url: 'https://example.org' },
  chemicals: [{ activeIngredient: 'Mancozeb', pcpbReg: 'PCPB(CR)0001' }],
  sw: { diseaseName: 'Baa chelewa', symptoms: ['mabaka meusi'], treatment: 'Ondoa mimea iliyoathirika.', prevention: ['Panda kwa nafasi'] },
};
const healthy: KnowledgeEntry = { ...sourced, diseaseName: 'Healthy', chemicals: [], treatment: 'No treatment needed.' };

test('unsourced entry gives name and symptoms only', () => {
  const a = getAdvice('Tomato___Late_Blight', 'en', { Tomato___Late_Blight: base });
  assert.equal(a.diseaseName, 'Late blight');
  assert.deepEqual(a.symptoms, ['dark patches']);
  assert.equal(a.treatment, null);
  assert.deepEqual(a.prevention, []);
  assert.deepEqual(a.chemicals, []);
});

test('sourced entry gives treatment, prevention and registered chemicals', () => {
  const a = getAdvice('Tomato___Late_Blight', 'en', { Tomato___Late_Blight: sourced });
  assert.equal(a.treatment, 'Remove infected plants.');
  assert.deepEqual(a.chemicals, [{ activeIngredient: 'Mancozeb', pcpbReg: 'PCPB(CR)0001' }]);
  assert.equal(a.source?.url, 'https://example.org');
});

test('Swahili comes from the sw block', () => {
  const a = getAdvice('Tomato___Late_Blight', 'sw', { Tomato___Late_Blight: sourced });
  assert.equal(a.diseaseName, 'Baa chelewa');
  assert.equal(a.treatment, 'Ondoa mimea iliyoathirika.');
});

test('Healthy never carries treatment or chemicals', () => {
  const a = getAdvice('Tomato___Healthy', 'en', { Tomato___Healthy: healthy });
  assert.equal(a.healthy, true);
  assert.equal(a.treatment, null);
  assert.deepEqual(a.chemicals, []);
});

test('unknown label throws (manifest/KB drift is a bug, not a reply)', () => {
  assert.throws(() => getAdvice('Tomato___Wilt', 'en', {}));
});
```

Save as `apps/backend/test/unit/advice.test.ts`. Run it. Expected: FAIL.

- [ ] **Step 2: Implement `packages/ai/advice.ts`**

```ts
import { diseaseOf, type Chemical, type KnowledgeEntry, type KnowledgeSource } from './manifest';

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
    };
}
```

- [ ] **Step 3: Run, commit**

```bash
npm run test:unit --workspace=backend
git add packages/ai/advice.ts apps/backend/test/unit/advice.test.ts
git commit -m "feat(ai): provenance-gated advice view"
```

---

### Task 7: Diagnosis core

**Files:**
- Create: `apps/backend/src/conversation/types.ts`
- Create: `apps/backend/src/conversation/diagnosis.ts`
- Create: `apps/backend/src/conversation/deps.ts`
- Modify: `apps/backend/src/services/scan.service.ts` (add `createScanWith`, `getScanState`, `updateScanState`)
- Create: `apps/backend/test/unit/diagnosis.test.ts`

**Interfaces:**
- Consumes: Tasks 2–6.
- Produces (`conversation/types.ts`):

```ts
import type { AdviceView, Lang } from '@farmassist/ai/advice';
import type { Band, RejectReason } from '@farmassist/ai/rules';
import type { ClassManifest, KnowledgeEntry } from '@farmassist/ai/manifest';
import type { QuestionPair } from '@farmassist/ai/questions';

export interface Owner { userId?: string | null; channelId?: string | null }
export interface ScanOriginInput extends Owner { farmId?: string | null; waMessageId?: string | null; mediaId?: string | null; workerVersion?: string | null }
export interface QuestionView { id: string; text: string; options: { id: string; text: string }[] }
export interface DiagnosisStep {
  scanId: string;
  band: Band;
  reason: RejectReason | null;
  label: string | null;
  crop: string | null;
  confidence: number;            // 0-1
  advice: AdviceView | null;     // band === 'confident'
  question: QuestionView | null; // band === 'ask'
}
export interface TraceEntry { tool: string; out: unknown }
export interface ScanState {
  id: string; userId: string | null; channelId: string | null; verifiedLabel: string | null;
  probs: Record<string, number> | null; crop: string | null; answers: { questionId: string; optionId: string }[];
  pendingQuestion: string | null; // the only question that may be answered next
  trace: TraceEntry[];
}
export interface DiagnosisDeps {
  manifest: ClassManifest;
  knowledge: Record<string, KnowledgeEntry>;
  questions: QuestionPair[];
  classify(image: Buffer, mimeType: string): Promise<{ raw: unknown; model: string }>;
  saveImage(bytes: Buffer, mimeType: string): Promise<string>;
  createScan(origin: ScanOriginInput, data: ScanWrite): Promise<{ id: string }>;
  getScan(id: string): Promise<ScanState | null>;
  updateScan(id: string, data: ScanWrite): Promise<void>;
}
export interface ScanWrite {
  imageUrl?: string; diseaseName: string; confidence: number | null; analysis?: unknown; model?: string;
  answers?: { questionId: string; optionId: string }[]; trace: TraceEntry[]; reviewStatus: string | null;
}
export class StaleAnswerError extends Error {}
export interface OutboundMessage { text: string; buttons?: { id: string; title: string }[] }
```

- `startDiagnosis(deps, origin, image: { bytes: Buffer; mimeType: string }, lang: Lang): Promise<DiagnosisStep>`
- `answerQuestion(deps, owner: Owner, scanId: string, questionId: string, optionId: string, lang: Lang): Promise<DiagnosisStep>` (throws `StaleAnswerError`)
- `QUESTION_CAP = 2`
- `realDeps(): DiagnosisDeps` from `deps.ts`

- [ ] **Step 1: Failing tests with fakes**

Create `apps/backend/test/unit/diagnosis.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadClassManifest, loadKnowledge } from '@farmassist/ai/manifest';
import type { QuestionPair } from '@farmassist/ai/questions';
import { answerQuestion, startDiagnosis } from '../../src/conversation/diagnosis';
import { StaleAnswerError, type DiagnosisDeps, type ScanState, type ScanWrite } from '../../src/conversation/types';

const pair: QuestionPair = {
  labels: ['Tomato___Early_Blight', 'Tomato___Late_Blight'],
  source: { title: 't', url: 'https://example.org' },
  questions: [
    { id: 'q1', text: { en: 'Where?', sw: 'Wapi?' }, options: [
      { id: 'lower', text: { en: 'Lower', sw: 'Chini' }, favours: 'Tomato___Early_Blight', weight: 0.9 },
      { id: 'unsure', text: { en: 'Not sure', sw: 'Sijui' }, favours: null, weight: 0.5 },
    ] },
    { id: 'q2', text: { en: 'Weather?', sw: 'Hewa?' }, options: [
      { id: 'dry', text: { en: 'Dry', sw: 'Kavu' }, favours: 'Tomato___Early_Blight', weight: 0.9 },
      { id: 'unsure', text: { en: 'Not sure', sw: 'Sijui' }, favours: null, weight: 0.5 },
    ] },
  ],
};

function fakeDeps(raw: unknown) {
  const scans = new Map<string, ScanState & { write: ScanWrite }>();
  let n = 0;
  const deps: DiagnosisDeps = {
    manifest: loadClassManifest(),
    knowledge: loadKnowledge(),
    questions: [pair],
    classify: async () => ({ raw, model: 'fake@1' }),
    saveImage: async () => 'scans/x.jpg',
    createScan: async (origin, data) => {
      const id = `s${++n}`;
      const a = data.analysis as any;
      scans.set(id, { id, userId: origin.userId ?? null, channelId: origin.channelId ?? null, verifiedLabel: null,
        probs: a?.probs ?? null, crop: a?.crop ?? null, answers: data.answers ?? [], pendingQuestion: a?.pendingQuestion ?? null, trace: data.trace, write: data });
      return { id };
    },
    getScan: async (id) => scans.get(id) ?? null,
    updateScan: async (id, data) => {
      const s = scans.get(id)!;
      const a = data.analysis as any;
      scans.set(id, { ...s, probs: a?.probs ?? s.probs, answers: data.answers ?? s.answers, pendingQuestion: a && 'pendingQuestion' in a ? a.pendingQuestion : s.pendingQuestion, trace: data.trace, write: data });
    },
  };
  return { deps, scans };
}

const img = { bytes: Buffer.from('x'), mimeType: 'image/jpeg' };
const confidentRaw = { crop: 'Tomato', predictions: [{ label: 'Tomato___Late_Blight', score: 0.97 }, { label: 'Tomato___Healthy', score: 0.01 }] };
const closeRaw = { crop: 'Tomato', predictions: [{ label: 'Tomato___Early_Blight', score: 0.55 }, { label: 'Tomato___Late_Blight', score: 0.4 }] };

test('confident: advice from the KB, scan captured with model and trace', async () => {
  const { deps, scans } = fakeDeps(confidentRaw);
  const step = await startDiagnosis(deps, { userId: 'u1' }, img, 'en');
  assert.equal(step.band, 'confident');
  assert.equal(step.label, 'Tomato___Late_Blight');
  assert.equal(step.advice?.diseaseName, loadKnowledge()['Tomato___Late_Blight'].diseaseName);
  const s = scans.get(step.scanId)!;
  assert.equal(s.write.imageUrl, 'scans/x.jpg');
  assert.equal(s.write.model, 'fake@1');
  assert.ok(s.write.trace.some((t) => t.tool === 'classify_image'));
  assert.ok(s.write.trace.some((t) => t.tool === 'get_advice'));
});

test('close call with a sourced pair asks the first question', async () => {
  const { deps } = fakeDeps(closeRaw);
  const step = await startDiagnosis(deps, { userId: 'u1' }, img, 'sw');
  assert.equal(step.band, 'ask');
  assert.equal(step.question?.id, 'q1');
  assert.equal(step.question?.text, 'Wapi?');
});

test('answers resolve to confident within the cap', async () => {
  const { deps } = fakeDeps(closeRaw);
  const s1 = await startDiagnosis(deps, { userId: 'u1' }, img, 'en');
  const s2 = await answerQuestion(deps, { userId: 'u1' }, s1.scanId, 'q1', 'lower', 'en');
  assert.equal(s2.band, 'confident');
  assert.equal(s2.label, 'Tomato___Early_Blight');
});

test('two "not sure" answers end uncertain and flag for review', async () => {
  const { deps, scans } = fakeDeps(closeRaw);
  const s1 = await startDiagnosis(deps, { userId: 'u1' }, img, 'en');
  const s2 = await answerQuestion(deps, { userId: 'u1' }, s1.scanId, 'q1', 'unsure', 'en');
  assert.equal(s2.band, 'ask');
  const s3 = await answerQuestion(deps, { userId: 'u1' }, s1.scanId, 'q2', 'unsure', 'en');
  assert.equal(s3.band, 'uncertain');
  assert.equal(scans.get(s1.scanId)!.write.reviewStatus, 'PENDING');
  assert.equal(scans.get(s1.scanId)!.write.diseaseName, 'Not sure');
});

test('stale, replayed, foreign and unknown answers are rejected', async () => {
  const { deps } = fakeDeps(closeRaw);
  const s1 = await startDiagnosis(deps, { userId: 'u1' }, img, 'en');
  await assert.rejects(answerQuestion(deps, { userId: 'u1' }, s1.scanId, 'q2', 'dry', 'en'), StaleAnswerError); // not the next question
  await assert.rejects(answerQuestion(deps, { userId: 'u2' }, s1.scanId, 'q1', 'lower', 'en'), StaleAnswerError); // someone else's scan
  await assert.rejects(answerQuestion(deps, { userId: 'u1' }, s1.scanId, 'q1', 'nope', 'en'), StaleAnswerError); // unknown option
  await answerQuestion(deps, { userId: 'u1' }, s1.scanId, 'q1', 'lower', 'en');
  await assert.rejects(answerQuestion(deps, { userId: 'u1' }, s1.scanId, 'q1', 'lower', 'en'), StaleAnswerError); // replay after resolving
  await assert.rejects(answerQuestion(deps, { userId: 'u1' }, 'missing', 'q1', 'lower', 'en'), StaleAnswerError);
});

test('checker failure is rejected/unreadable, still captured', async () => {
  const { deps, scans } = fakeDeps({ crop: 'Tomato', predictions: [{ label: 'Potato___Late_Blight', score: 0.9 }] });
  const step = await startDiagnosis(deps, { userId: 'u1' }, img, 'en');
  assert.deepEqual([step.band, step.reason], ['rejected', 'unreadable']);
  assert.equal(scans.get(step.scanId)!.write.model, 'fake@1');
});

test('unsupported crop and not-a-plant are rejected with their reasons', async () => {
  for (const [raw, reason] of [[{ crop: 'Unsupported', predictions: [] }, 'unsupported'], [{ crop: 'NotAPlant', predictions: [] }, 'not_plant']] as const) {
    const { deps } = fakeDeps(raw);
    const step = await startDiagnosis(deps, { userId: 'u1' }, img, 'en');
    assert.deepEqual([step.band, step.reason], ['rejected', reason]);
  }
});

test('close call with no sourced pair is uncertain, not asked', async () => {
  const { deps } = fakeDeps(closeRaw);
  deps.questions = [{ ...pair, source: null }];
  const step = await startDiagnosis(deps, { userId: 'u1' }, img, 'en');
  assert.equal(step.band, 'uncertain');
});
```

Run: `npm run test:unit --workspace=backend`. Expected: FAIL (modules missing).

- [ ] **Step 2: Write `conversation/types.ts`**

Use the exact content of the Interfaces block above.

- [ ] **Step 3: Implement `conversation/diagnosis.ts`**

```ts
import { decide } from '@farmassist/ai/abstention';
import { getAdvice, type Lang } from '@farmassist/ai/advice';
import { checkClassifierOutput } from '@farmassist/ai/checker';
import { applyAnswer, nextQuestion, pairFor, type QuestionPair } from '@farmassist/ai/questions';
import { bandFor } from '@farmassist/ai/rules';
import {
  StaleAnswerError, type DiagnosisDeps, type DiagnosisStep, type Owner, type QuestionView,
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
  const imageUrl = await deps.saveImage(image.bytes, image.mimeType);
  const { raw, model } = await deps.classify(image.bytes, image.mimeType);
  const checked = checkClassifierOutput(raw, deps.manifest);
  const trace: TraceEntry[] = [{ tool: 'classify_image', out: checked.ok ? checked.value : { error: checked.error } }];

  const rejected = (reason: 'unreadable' | 'unsupported' | 'not_plant', diseaseName: string, crop: string | null) =>
    deps.createScan(origin, { imageUrl, model, analysis: { raw }, diseaseName, confidence: null, trace, reviewStatus: null })
      .then(({ id }): DiagnosisStep => ({ scanId: id, band: 'rejected', reason, label: null, crop, confidence: 0, advice: null, question: null }));

  if (!checked.ok) return rejected('unreadable', 'Unreadable photo', null);
  if (checked.value.kind === 'not_plant') return rejected('not_plant', 'Not a plant', null);
  if (checked.value.kind === 'unsupported') return rejected('unsupported', 'Unsupported crop', checked.value.crop);

  const { crop, probs } = checked.value;
  const { id } = await deps.createScan(origin, { imageUrl, model, analysis: { raw, crop, probs }, diseaseName: 'Not sure', confidence: null, answers: [], trace, reviewStatus: null });
  const { step, write } = resolve(deps, id, probs, crop, [], lang, trace);
  await deps.updateScan(id, { ...write, analysis: { raw, crop, probs, pendingQuestion: step.question?.id ?? null }, answers: [], trace });
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
```

`analysis.pendingQuestion` records the one question the scan is waiting on. Any other answer, including one sent after the scan resolves, is stale. The pair is re-derived from the top two labels; re-scoring only moves mass inside the pair, so it stays the same. Since `answers` and `trace` are written on every step, the scan row carries the full conversation.

`answerQuestion` writes `analysis: { crop, probs }` and drops `raw`. Keep `raw` by merging, in `scan.service.updateScanState` (Step 4).

- [ ] **Step 4: Scan service helpers**

Append to `apps/backend/src/services/scan.service.ts`:

```ts
import type { ScanOriginInput, ScanState, ScanWrite } from '../conversation/types';

export async function createScanWith(origin: ScanOriginInput, data: ScanWrite) {
  const fields = {
    userId: origin.userId ?? null, channelId: origin.channelId ?? null, farmId: origin.farmId ?? null,
    waMessageId: origin.waMessageId ?? null, mediaId: origin.mediaId ?? null, workerVersion: origin.workerVersion ?? null,
    imageUrl: data.imageUrl ?? null, diseaseName: data.diseaseName, confidence: data.confidence,
    analysis: data.analysis as any, model: data.model ?? null, answers: (data.answers ?? []) as any,
    trace: data.trace as any, reviewStatus: data.reviewStatus,
  };
  if (!origin.waMessageId) return prisma.scan.create({ data: fields, select: { id: true } });
  // Replayed WhatsApp delivery: return the scan already made for this message.
  const existing = await prisma.scan.findUnique({ where: { waMessageId: origin.waMessageId }, select: { id: true } });
  return existing ?? prisma.scan.create({ data: fields, select: { id: true } });
}

export async function getScanState(id: string): Promise<ScanState | null> {
  const s = await prisma.scan.findUnique({ where: { id } });
  if (!s) return null;
  const a = (s.analysis ?? {}) as { probs?: Record<string, number>; crop?: string; pendingQuestion?: string | null };
  return {
    id: s.id, userId: s.userId, channelId: s.channelId, verifiedLabel: s.verifiedLabel,
    probs: a.probs ?? null, crop: a.crop ?? null,
    answers: (s.answers ?? []) as ScanState['answers'], pendingQuestion: a.pendingQuestion ?? null, trace: (s.trace ?? []) as ScanState['trace'],
  };
}

export async function updateScanState(id: string, data: ScanWrite) {
  const prev = await prisma.scan.findUnique({ where: { id }, select: { analysis: true } });
  await prisma.scan.update({
    where: { id },
    data: {
      diseaseName: data.diseaseName, confidence: data.confidence, reviewStatus: data.reviewStatus,
      analysis: { ...((prev?.analysis as object) ?? {}), ...((data.analysis as object) ?? {}) } as any,
      answers: (data.answers ?? undefined) as any, trace: data.trace as any,
    },
  });
}
```

- [ ] **Step 5: Real deps**

Create `apps/backend/src/conversation/deps.ts`:

```ts
import { loadClassManifest, loadKnowledge } from '@farmassist/ai/manifest';
import { loadQuestions } from '@farmassist/ai/questions';
import { classifier } from '@farmassist/ai/classifier';
import { saveScanImage } from '../services/imageStore.service';
import * as scanService from '../services/scan.service';
import type { DiagnosisDeps } from './types';

let cached: DiagnosisDeps | null = null;

/** Real wiring. The classifier is read through its object on every call, so tests can stub it. */
export function realDeps(): DiagnosisDeps {
  cached ??= {
    manifest: loadClassManifest(),
    knowledge: loadKnowledge(),
    questions: loadQuestions(),
    classify: (bytes, mime) => classifier.classify(bytes, mime),
    saveImage: saveScanImage,
    createScan: scanService.createScanWith,
    getScan: scanService.getScanState,
    updateScan: scanService.updateScanState,
  };
  return cached;
}
```

- [ ] **Step 6: Run, typecheck, commit**

```bash
npm run test:unit --workspace=backend
(cd apps/backend && npx tsc --noEmit)
git add apps/backend/src/conversation apps/backend/src/services/scan.service.ts apps/backend/test/unit/diagnosis.test.ts
git commit -m "feat(conversation): channel-neutral diagnosis core with questions and review flag"
```
Expected: all unit tests pass; tsc clean.

---

### Task 8: Messages, rendering, faithfulness

**Files:**
- Create: `apps/backend/src/conversation/i18n.ts`
- Create: `apps/backend/src/conversation/render.ts`
- Create: `apps/backend/test/unit/render.test.ts`

**Interfaces:**
- Produces:
  - `t(key: MessageKey, lang: Lang, params?: Record<string, string>): string`
  - `renderStep(step: DiagnosisStep, lang: Lang, supportedCrops: string[]): OutboundMessage[]`
  - `renderText(key, lang)`
  - `checkFaithful(messages: OutboundMessage[], step: DiagnosisStep): string[]`
  - Button ids use the format `a:<scanId>:<questionId>:<optionId>`, exported as `answerButtonId` and `parseAnswerButtonId`.

- [ ] **Step 1: Failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, t } from '../../src/conversation/i18n';
import { checkFaithful, parseAnswerButtonId, renderStep } from '../../src/conversation/render';
import type { DiagnosisStep } from '../../src/conversation/types';

const crops = ['Coffee', 'Tomato'];
const confident: DiagnosisStep = {
  scanId: 's1', band: 'confident', reason: null, label: 'Tomato___Late_Blight', crop: 'Tomato', confidence: 0.93, question: null,
  advice: { label: 'Tomato___Late_Blight', diseaseName: 'Late blight', symptoms: ['dark patches'], treatment: 'Remove infected plants.',
    prevention: ['Space plants'], chemicals: [{ activeIngredient: 'Mancozeb', pcpbReg: 'PCPB(CR)0001' }], source: { title: 'G', url: 'https://x' }, healthy: false },
};

test('every catalog key exists in English and Swahili', () => {
  for (const [key, v] of Object.entries(CATALOG)) assert.ok(v.en.trim() && v.sw.trim(), key);
});

test('params interpolate and unknown params stay visible', () => {
  assert.equal(t('reject.unsupported', 'en', { crops: 'Coffee, Tomato' }).includes('Coffee, Tomato'), true);
});

test('confident reply carries KB text only and is faithful', () => {
  const msgs = renderStep(confident, 'en', crops);
  const all = msgs.map((m) => m.text).join('\n');
  assert.match(all, /Late blight/);
  assert.match(all, /Remove infected plants\./);
  assert.match(all, /Mancozeb/);
  assert.match(all, /agrovet/i);
  assert.deepEqual(checkFaithful(msgs, confident), []);
});

test('unsourced advice says ask your agrovet', () => {
  const step = { ...confident, advice: { ...confident.advice!, treatment: null, prevention: [], chemicals: [], source: null } };
  assert.match(renderStep(step, 'sw', crops).map((m) => m.text).join('\n'), /agrovet/i);
});

test('ask renders up to 3 buttons within 20 chars with parseable ids', () => {
  const step: DiagnosisStep = { ...confident, band: 'ask', advice: null, label: null,
    question: { id: 'q1', text: 'Where?', options: [{ id: 'lower', text: 'Old lower leaves' }, { id: 'unsure', text: 'Not sure' }] } };
  const [m] = renderStep(step, 'en', crops);
  assert.equal(m.buttons?.length, 2);
  for (const b of m.buttons!) assert.ok(b.title.length <= 20);
  assert.deepEqual(parseAnswerButtonId(m.buttons![0].id), { scanId: 's1', questionId: 'q1', optionId: 'lower' });
  assert.equal(parseAnswerButtonId('garbage'), null);
});

test('a reply naming a chemical not in the advice is unfaithful', () => {
  const tampered = [{ text: 'Spray Chlorothalonil now' }];
  assert.ok(checkFaithful(tampered, confident).length > 0);
});

test('uncertain and rejected replies have fixed text', () => {
  for (const s of [{ ...confident, band: 'uncertain' as const, advice: null },
    { ...confident, band: 'rejected' as const, reason: 'not_plant' as const, advice: null }]) {
    assert.ok(renderStep(s, 'en', crops)[0].text.length > 0);
  }
});
```

Save as `apps/backend/test/unit/render.test.ts`. Run it. Expected: FAIL.

- [ ] **Step 2: Implement `conversation/i18n.ts`**

```ts
import type { Lang } from '@farmassist/ai/advice';

export const CATALOG = {
  'diagnosis.result': { en: '{disease} ({crop}), {confidence}% sure.', sw: '{disease} ({crop}), uhakika {confidence}%.' },
  'diagnosis.healthy': { en: 'Your {crop} looks healthy.', sw: '{crop} yako inaonekana na afya.' },
  'diagnosis.symptoms': { en: 'Signs: {list}', sw: 'Dalili: {list}' },
  'diagnosis.treatment': { en: 'What to do: {text}', sw: 'Cha kufanya: {text}' },
  'diagnosis.prevention': { en: 'Prevent it: {list}', sw: 'Kuzuia: {list}' },
  'diagnosis.chemicals': {
    en: 'Registered products contain: {list}. Ask your agrovet for the right product and dose.',
    sw: 'Bidhaa zilizosajiliwa zina: {list}. Muulize mwuzaji wa pembejeo (agrovet) bidhaa na kipimo sahihi.',
  },
  'diagnosis.no_advice': { en: 'Ask your agrovet for treatment.', sw: 'Muulize agrovet wako kuhusu tiba.' },
  'diagnosis.footer': {
    en: 'This is advice, not a guarantee. Consult an agrovet if symptoms spread.',
    sw: 'Huu ni ushauri, si uhakika. Wasiliana na agrovet dalili zikienea.',
  },
  'diagnosis.uncertain': {
    en: "I'm not sure what this is. An expert will check your photo.",
    sw: 'Sina uhakika ni nini. Mtaalamu ataangalia picha yako.',
  },
  'question.intro': { en: 'I need one detail to be sure. {question}', sw: 'Nahitaji jambo moja ili niwe na uhakika. {question}' },
  'reject.unsupported': { en: "I can't diagnose this crop yet. I cover {crops}.", sw: 'Bado siwezi kutambua zao hili. Ninashughulikia {crops}.' },
  'reject.not_plant': { en: "I couldn't see a plant. Send a close photo of one leaf.", sw: 'Sikuona mmea. Tuma picha ya karibu ya jani moja.' },
  'reject.unreadable': { en: "I couldn't read that photo. Try another, in daylight.", sw: 'Sikuweza kusoma picha hiyo. Jaribu nyingine, mchana.' },
  help: { en: "Send a photo of one sick leaf and I'll tell you what it is.", sw: 'Tuma picha ya jani moja lililo na ugonjwa nami nitakuambia ni nini.' },
  'error.retry': { en: 'Something went wrong. Please send the photo again.', sw: 'Kuna hitilafu. Tafadhali tuma picha tena.' },
  'answer.stale': { en: 'That question has expired. Send the photo again.', sw: 'Swali hilo limepitwa na wakati. Tuma picha tena.' },
} as const;

export type MessageKey = keyof typeof CATALOG;

export function t(key: MessageKey, lang: Lang, params: Record<string, string> = {}): string {
  return CATALOG[key][lang].replace(/\{(\w+)\}/g, (m, p) => params[p] ?? m);
}
```

Have a fluent Swahili speaker review the Swahili lines before launch. Record this in the PR description as a launch item; it is not a code gate.

- [ ] **Step 3: Implement `conversation/render.ts`**

```ts
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
  const allowed = new Set((step.advice?.chemicals ?? []).flatMap((c) => c.activeIngredient.toLowerCase().split(/[\s,+/]+/)));
  const violations: string[] = [];
  for (const m of messages) {
    for (const word of m.text.match(CHEMICAL_WORDS) ?? []) {
      if (!allowed.has(word.toLowerCase())) violations.push(`unsourced chemical: ${word}`);
    }
  }
  return violations;
}
```

- [ ] **Step 4: Run, commit**

```bash
npm run test:unit --workspace=backend
git add apps/backend/src/conversation/i18n.ts apps/backend/src/conversation/render.ts apps/backend/test/unit/render.test.ts
git commit -m "feat(conversation): bilingual replies, answer buttons and faithfulness check"
```

---

### Task 9: WhatsApp transport and image filter

**Files:**
- Create: `apps/backend/src/conversation/filter.ts`
- Create: `apps/backend/src/channels/whatsapp/graph.ts`
- Create: `apps/backend/src/channels/whatsapp/sender.ts`
- Modify: `apps/backend/src/channels/whatsapp/types.ts`, `intent.router.ts`
- Modify: `apps/backend/src/services/channelEvent.service.ts` (add `'message.button'` to `ChannelEventType`)
- Create: `apps/backend/test/unit/transport.test.ts`

**Interfaces:**
- Produces:
  - `checkImage(bytes: Buffer): Promise<'ok' | 'unreadable' | 'too_small' | 'too_large'>`
  - `graph = { post(path: string, body: unknown): Promise<any>; getJson(path: string): Promise<any>; getBytes(url: string): Promise<Buffer> }`
  - `downloadMedia(mediaId: string): Promise<{ bytes: Buffer; mimeType: string }>` throws `MediaTooLargeError`
  - `toMetaPayload(to: string, m: OutboundMessage): object`
  - `sendMessages(channel: { id: string; phone: string; lastInboundAt: Date | null }, messages: OutboundMessage[]): Promise<number>` (returns the count sent; returns 0 and logs when the 24-hour window is closed)
  - `Intent` gains `{ kind: 'message.button'; id: string; title: string }`

- [ ] **Step 1: Failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { checkImage } from '../../src/conversation/filter';
import { routeIntent } from '../../src/channels/whatsapp/intent.router';
import { toMetaPayload } from '../../src/channels/whatsapp/sender';

test('image filter: ok, too small, unreadable', async () => {
  const ok = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#2e7d32' } }).jpeg().toBuffer();
  const small = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#2e7d32' } }).jpeg().toBuffer();
  assert.equal(await checkImage(ok), 'ok');
  assert.equal(await checkImage(small), 'too_small');
  assert.equal(await checkImage(Buffer.from('not an image')), 'unreadable');
});

test('router maps an interactive button reply', () => {
  const intent = routeIntent({ from: '254700000001', id: 'w1', timestamp: '1', type: 'interactive',
    interactive: { type: 'button_reply', button_reply: { id: 'a:s1:q1:lower', title: 'Old lower leaves' } } } as any);
  assert.deepEqual(intent, { kind: 'message.button', id: 'a:s1:q1:lower', title: 'Old lower leaves' });
});

test('text and button payloads match the Graph API shape', () => {
  assert.deepEqual(toMetaPayload('+254700000001', { text: 'hi' }),
    { messaging_product: 'whatsapp', to: '254700000001', type: 'text', text: { body: 'hi' } });
  const p: any = toMetaPayload('+254700000001', { text: 'Q?', buttons: [{ id: 'a:s:q:o', title: 'Yes' }] });
  assert.equal(p.type, 'interactive');
  assert.deepEqual(p.interactive.action.buttons, [{ type: 'reply', reply: { id: 'a:s:q:o', title: 'Yes' } }]);
});
```

Save as `apps/backend/test/unit/transport.test.ts`. Run it. Expected: FAIL.

- [ ] **Step 2: `conversation/filter.ts`**

```ts
import sharp from 'sharp';

const MAX_BYTES = 10 * 1024 * 1024;
const MIN_SIDE = 224;
// ponytail: no blur detection; add a Laplacian-variance check if the eval shows blur is a failure mode.

export async function checkImage(bytes: Buffer): Promise<'ok' | 'unreadable' | 'too_small' | 'too_large'> {
  if (bytes.length > MAX_BYTES) return 'too_large';
  try {
    const { width, height } = await sharp(bytes).metadata();
    if (!width || !height) return 'unreadable';
    return Math.min(width, height) < MIN_SIDE ? 'too_small' : 'ok';
  } catch {
    return 'unreadable';
  }
}
```

- [ ] **Step 3: Router and types**

In `channels/whatsapp/types.ts` add:

```ts
export interface MetaInteractiveMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'interactive';
  interactive: { type: 'button_reply'; button_reply: { id: string; title: string } } | { type: string };
}
```

and change `MetaMessage` to `MetaTextMessage | MetaMediaMessage | MetaInteractiveMessage | MetaOtherMessage`. Also add `file_size?: number` to `MetaMediaMessage.image`.

In `intent.router.ts`, add `| { kind: 'message.button'; id: string; title: string }` to `Intent`, and add this before the final `return` of `routeIntent`:

```ts
  if (message.type === 'interactive') {
    const i = (message as MetaInteractiveMessage).interactive;
    if (i?.type === 'button_reply' && 'button_reply' in i) return { kind: 'message.button', id: i.button_reply.id, title: i.button_reply.title };
    return { kind: 'message.unsupported', type: 'interactive' };
  }
```

Import `MetaInteractiveMessage`. In `inbound.worker.ts` `intentToEventType`, add `case 'message.button': return 'message.button';`, and add `'message.button'` to `ChannelEventType` in `channelEvent.service.ts`.

- [ ] **Step 4: `graph.ts` and `sender.ts`**

`graph.ts`:

```ts
import { env } from '../../config/env';

const base = () => `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}`;
const auth = () => ({ Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` });

/** Object so tests replace calls instead of the global fetch the test server also uses. */
export const graph = {
  async post(path: string, body: unknown): Promise<any> {
    const r = await fetch(`${base()}${path}`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`Graph POST ${path} failed: ${r.status} ${await r.text()}`);
    return r.json();
  },
  async getJson(path: string): Promise<any> {
    const r = await fetch(`${base()}${path}`, { headers: auth() });
    if (!r.ok) throw new Error(`Graph GET ${path} failed: ${r.status}`);
    return r.json();
  },
  async getBytes(url: string): Promise<Buffer> {
    const r = await fetch(url, { headers: auth() });
    if (!r.ok) throw new Error(`media download failed: ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  },
};

export class MediaTooLargeError extends Error {}
const MAX_MEDIA = 10 * 1024 * 1024;

export async function downloadMedia(mediaId: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const meta = await graph.getJson(`/${encodeURIComponent(mediaId)}`);
  if (typeof meta.file_size === 'number' && meta.file_size > MAX_MEDIA) throw new MediaTooLargeError(String(meta.file_size));
  const bytes = await graph.getBytes(meta.url);
  if (bytes.length > MAX_MEDIA) throw new MediaTooLargeError(String(bytes.length));
  return { bytes, mimeType: meta.mime_type };
}
```

`sender.ts`:

```ts
import { env } from '../../config/env';
import * as channelEventService from '../../services/channelEvent.service';
import { isServiceWindowOpen } from '../../services/farmer.service';
import type { OutboundMessage } from '../../conversation/types';
import { graph } from './graph';

export function toMetaPayload(to: string, m: OutboundMessage) {
  const recipient = to.replace(/^\+/, '');
  if (!m.buttons?.length) return { messaging_product: 'whatsapp', to: recipient, type: 'text', text: { body: m.text } };
  return {
    messaging_product: 'whatsapp', to: recipient, type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: m.text },
      action: { buttons: m.buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) },
    },
  };
}

/** Free-form replies only inside Meta's 24-hour window, enforced here rather than at Meta. */
export async function sendMessages(channel: { id: string; phone: string; lastInboundAt: Date | null }, messages: OutboundMessage[]): Promise<number> {
  if (!isServiceWindowOpen(channel.lastInboundAt)) {
    console.warn(`[whatsapp] window closed for channel ${channel.id}; ${messages.length} message(s) not sent`);
    return 0;
  }
  let sent = 0;
  for (const m of messages) {
    const res = await graph.post(`/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, toMetaPayload(channel.phone, m));
    await channelEventService.recordEvent({
      channelId: channel.id, direction: 'OUTBOUND', type: 'outbound.freeform',
      waMessageId: res?.messages?.[0]?.id ?? null, metadata: { buttons: m.buttons?.length ?? 0 },
    });
    sent++;
  }
  return sent;
}
```

`sender.ts` imports `config/env`, whose zod schema requires `DATABASE_URL` and the Firebase vars. To keep `transport.test.ts` network-free, set dummy values at the top of that test file before the imports:

```ts
process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/x';
process.env.OPENAI_API_KEY ??= 'test';
process.env.FIREBASE_PROJECT_ID ??= 'test';
```

Check the env schema for any other required var and add it the same way. Prisma does not connect at import time.

- [ ] **Step 5: Run, typecheck, commit**

```bash
npm run test:unit --workspace=backend
(cd apps/backend && npx tsc --noEmit)
npm run test:whatsapp --workspace=backend
git add apps/backend/src apps/backend/test/unit/transport.test.ts
git commit -m "feat(whatsapp): button replies, Graph sender with window check, media download, image filter"
```
Expected: all pass. The WhatsApp suite stays 38/38, because routing only gains a case.

---

### Task 10: Wire WhatsApp to the core

**Files:**
- Create: `apps/backend/src/channels/whatsapp/conversation.ts`
- Modify: `apps/backend/src/channels/whatsapp/inbound.worker.ts`
- Modify: `apps/backend/scripts/whatsapp-inbound-test.ts`

**Interfaces:**
- Consumes: `startDiagnosis`, `answerQuestion`, `realDeps`, `renderStep`, `checkFaithful`, `t`, `parseAnswerButtonId`, `checkImage`, `downloadMedia`, `sendMessages`.
- Produces: `handleConversation(channel: FarmerChannelRow, intent: Intent, waMessageId: string): Promise<void>`

- [ ] **Step 1: Failing integration checks**

In `scripts/whatsapp-inbound-test.ts`, after the existing requires, stub Graph and the classifier:

```ts
const { graph } = require('../src/channels/whatsapp/graph');
const ai = require('@farmassist/ai/classifier');
const sent: any[] = [];
graph.post = async (_path: string, body: any) => { sent.push(body); return { messages: [{ id: `wamid.out.${sent.length}` }] }; };
graph.getJson = async (path: string) => path.includes('too-big')
  ? { url: 'https://media/x', mime_type: 'image/jpeg', file_size: 20 * 1024 * 1024 }
  : { url: 'https://media/x', mime_type: 'image/jpeg', file_size: 1000 };
let leafBytes: Buffer;
graph.getBytes = async () => leafBytes;
let nextRaw: unknown = null;
ai.classifier.classify = async () => ({ raw: nextRaw, model: 'stub@1' });
```

Add `'254700000910'` and `'254700000911'` to `PHONES`. Then add this section at the end of `run()`. `handleInboundJob` is already imported.

```ts
  leafBytes = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#2e7d32' } }).jpeg().toBuffer();
  const job = (from: string, id: string, message: Record<string, unknown>) =>
    ({ kind: 'message', phoneNumberId: 'test', receivedAt: new Date().toISOString(), message: { from, id, timestamp: '1', ...message } });

  // Confident photo → one text reply with KB name.
  nextRaw = { crop: 'Tomato', predictions: [{ label: 'Tomato___Late_Blight', score: 0.97 }] };
  sent.length = 0;
  await handleInboundJob(job('254700000910', 'wamid.conv.1', { type: 'image', image: { id: 'media-1', mime_type: 'image/jpeg' } }) as any);
  check('photo gets one reply', sent.length === 1 && sent[0].type === 'text', JSON.stringify(sent));
  const conf = await prisma.scan.findFirst({ where: { waMessageId: 'wamid.conv.1' } });
  check('WhatsApp scan captured with channel and model', !!conf?.channelId && conf?.model === 'stub@1' && !!conf?.imageUrl);

  // Close call → question buttons; tap → resolution.
  const questions = require('@farmassist/ai/questions');
  const pairs = questions.loadQuestions();
  const sourced = pairs.some((p: any) => p.source);
  if (sourced) {
    nextRaw = { crop: 'Tomato', predictions: [{ label: 'Tomato___Early_Blight', score: 0.55 }, { label: 'Tomato___Late_Blight', score: 0.4 }] };
    sent.length = 0;
    await handleInboundJob(job('254700000910', 'wamid.conv.2', { type: 'image', image: { id: 'media-2', mime_type: 'image/jpeg' } }) as any);
    check('close call sends buttons', sent[0]?.type === 'interactive', JSON.stringify(sent[0]));
    const btn = sent[0].interactive.action.buttons[0].reply;
    sent.length = 0;
    await handleInboundJob(job('254700000910', 'wamid.conv.3', { type: 'interactive', interactive: { type: 'button_reply', button_reply: btn } }) as any);
    check('button tap gets a reply', sent.length === 1);
    sent.length = 0;
    await handleInboundJob(job('254700000910', 'wamid.conv.4', { type: 'interactive', interactive: { type: 'button_reply', button_reply: btn } }) as any);
    check('replayed button tap is told the question expired', /expired|limepitwa/.test(JSON.stringify(sent)));
  }

  // Oversized media → unreadable reply, no classifier call.
  let classified = false;
  const realClassify = ai.classifier.classify;
  ai.classifier.classify = async () => { classified = true; return realClassify(); };
  sent.length = 0;
  await handleInboundJob(job('254700000910', 'wamid.conv.5', { type: 'image', image: { id: 'too-big', mime_type: 'image/jpeg' } }) as any);
  check('oversized photo is refused without a model call', !classified && /photo|picha/.test(JSON.stringify(sent)));
  ai.classifier.classify = async () => ({ raw: nextRaw, model: 'stub@1' });

  // Text → help.
  sent.length = 0;
  await handleInboundJob(job('254700000910', 'wamid.conv.6', { type: 'text', text: { body: 'habari' } }) as any);
  check('free text gets the help reply', /leaf|jani/.test(JSON.stringify(sent)));

  // Opted out → silence.
  await handleInboundJob(job('254700000911', 'wamid.conv.7', { type: 'text', text: { body: 'STOP' } }) as any);
  sent.length = 0;
  await handleInboundJob(job('254700000911', 'wamid.conv.8', { type: 'image', image: { id: 'media-3', mime_type: 'image/jpeg' } }) as any);
  check('opted-out farmer gets no reply', sent.length === 0);
```

Add scan cleanup for these phones in `cleanup()`, before channels are deleted:

```ts
  const chans = await prisma.farmerChannel.findMany({ where: { phone: { in: PHONES.map((p) => `+${p}`) } }, select: { id: true } });
  await prisma.scan.deleteMany({ where: { channelId: { in: chans.map((c: { id: string }) => c.id) } } });
```

Run: `npm run test:whatsapp --workspace=backend`. Expected: FAIL. The photo gets no reply, because the worker still logs "no handler yet".

- [ ] **Step 2: Implement `channels/whatsapp/conversation.ts`**

```ts
import type { Lang } from '@farmassist/ai/advice';
import { answerQuestion, startDiagnosis } from '../../conversation/diagnosis';
import { realDeps } from '../../conversation/deps';
import { checkImage } from '../../conversation/filter';
import { t } from '../../conversation/i18n';
import { checkFaithful, parseAnswerButtonId, renderStep } from '../../conversation/render';
import { StaleAnswerError, type OutboundMessage } from '../../conversation/types';
import { downloadMedia, MediaTooLargeError } from './graph';
import type { Intent } from './intent.router';
import { sendMessages } from './sender';
import { WORKER_VERSION } from './version';

interface Channel { id: string; phone: string; userId: string | null; language: string; optedOut: boolean; lastInboundAt: Date | null }

const langOf = (c: Channel): Lang => (c.language === 'en' ? 'en' : 'sw');

export async function handleConversation(channel: Channel, intent: Intent, waMessageId: string): Promise<void> {
  if (channel.optedOut) return;
  const lang = langOf(channel);
  const deps = realDeps();
  const reply = (messages: OutboundMessage[]) => sendMessages(channel, messages);

  try {
    if (intent.kind === 'message.image') {
      let image: { bytes: Buffer; mimeType: string };
      try {
        image = await downloadMedia(intent.mediaId);
      } catch (e) {
        if (e instanceof MediaTooLargeError) return void (await reply([{ text: t('reject.unreadable', lang) }]));
        throw e;
      }
      if ((await checkImage(image.bytes)) !== 'ok') return void (await reply([{ text: t('reject.unreadable', lang) }]));
      const step = await startDiagnosis(deps,
        { channelId: channel.id, userId: channel.userId, waMessageId, mediaId: intent.mediaId, workerVersion: WORKER_VERSION },
        image, lang);
      return void (await reply(safe(renderStep(step, lang, deps.manifest.trainedCrops), step, lang)));
    }
    if (intent.kind === 'message.button') {
      const parsed = parseAnswerButtonId(intent.id);
      if (!parsed) return void (await reply([{ text: t('answer.stale', lang) }]));
      const step = await answerQuestion(deps, { channelId: channel.id }, parsed.scanId, parsed.questionId, parsed.optionId, lang);
      return void (await reply(safe(renderStep(step, lang, deps.manifest.trainedCrops), step, lang)));
    }
    if (intent.kind === 'message.text') return void (await reply([{ text: t('help', lang) }]));
  } catch (e) {
    if (e instanceof StaleAnswerError) return void (await reply([{ text: t('answer.stale', lang) }]));
    console.error('[whatsapp] conversation failed:', e);
    await reply([{ text: t('error.retry', lang) }]);
  }
}

/** Faithfulness gate before anything leaves the system. */
function safe(messages: OutboundMessage[], step: Parameters<typeof checkFaithful>[1], lang: Lang): OutboundMessage[] {
  const violations = checkFaithful(messages, step);
  if (violations.length === 0) return messages;
  console.error('[whatsapp] unfaithful reply blocked:', violations);
  return [{ text: t('diagnosis.uncertain', lang) }];
}
```

Move `WORKER_VERSION` into a new `channels/whatsapp/version.ts` (`export const WORKER_VERSION = 'inbound@2';`) to avoid a circular import, and re-export it from `inbound.worker.ts`. The value goes from `@1` to `@2` because the worker now replies.

- [ ] **Step 3: Call it from the worker**

In `inbound.worker.ts` `handleMessage`, replace the `default:` branch of the `switch` with:

```ts
    default:
      await handleConversation(channel, intent, message.id);
      return;
```

Add the import: `import { handleConversation } from './conversation';`. Check that `touchChannel`'s return value includes `phone`, `userId`, `language`, `optedOut` and `lastInboundAt`. It returns the full row with `include: { user: true }`, so it does.

- [ ] **Step 4: Run, commit**

```bash
DATABASE_URL='...' npm run test:whatsapp --workspace=backend
npm run test:unit --workspace=backend
(cd apps/backend && npx tsc --noEmit)
git add apps/backend
git commit -m "feat(whatsapp): diagnose photos and answer questions in the chat"
```
Expected: all pass. The question checks run only once Task 13 sources a pair. Note that in the task ledger, and re-run this suite after Task 13.

---

### Task 11: REST on the core

**Files:**
- Modify: `apps/backend/src/controllers/scan.controller.ts`, `routes/scan.routes.ts`
- Modify: `apps/backend/src/controllers/dashboard.controller.ts`
- Modify: `packages/ai/index.ts` (remove `openaiVision`; export `classifier`)
- Modify: `apps/backend/src/services/scan.service.ts` (remove `diagnoseAndRecord`)
- Modify: `apps/backend/scripts/integration-test.ts`, `apps/backend/scripts/ai-cache-test.ts`

**Interfaces:**
- Produces:
  - `POST /api/v1/scans { imageBase64, farmId? }` returns `201 { step: DiagnosisStep }`, `400` for a bad image, `403` for a foreign farm, `502` when the model fails.
  - `POST /api/v1/scans/:id/answer { questionId, optionId }` returns `200 { step }`, or `409 { error: 'expired' }` when stale or foreign.
  - The dashboard's `awaitingScans` count excludes `Not sure`, `Unsupported crop`, `Not a plant` and `Unreadable photo`.

- [ ] **Step 1: Update the failing integration checks**

In `integration-test.ts`:
1. Replace the `ai.openaiVision.diagnose` stub with a `classifier` stub:

```ts
const aiClassifier = require('@farmassist/ai/classifier');
let aiShouldFail = false;
let nextRaw: unknown = { crop: 'Tomato', predictions: [{ label: 'Tomato___Early_Blight', score: 0.97 }] };
aiClassifier.classifier.classify = async () => {
  if (aiShouldFail) throw new Error('stubbed OpenAI outage');
  return { raw: nextRaw, model: 'stub:test@00000000' };
};
```

2. Change the scan checks to the new response: read `created.step.scanId` and load the row with `prisma.scan.findUnique` for the `analysis`, `model` and `imageUrl` assertions. The same-image check compares the two rows' `imageUrl`.
3. `client-supplied diagnosis is ignored` becomes: the row's `diseaseName` equals the KB `diseaseName` for `Tomato___Early_Blight`.
4. Make the test image 300×300 (it already is), so it passes `checkImage`.
5. Add:

```ts
  nextRaw = { crop: 'Unsupported', predictions: [] };
  res = await fetch(`${base}/api/v1/scans`, { method: 'POST', headers: jsonAuth, body: JSON.stringify({ imageBase64 }) });
  check('unsupported crop is a rejected step', (await res.json() as any).step?.reason === 'unsupported');
  nextRaw = { crop: 'Tomato', predictions: [{ label: 'Tomato___Early_Blight', score: 0.97 }] };

  res = await fetch(`${base}/api/v1/scans/${created.step.scanId}/answer`, { method: 'POST', headers: jsonAuth, body: JSON.stringify({ questionId: 'spot_start', optionId: 'lower' }) });
  check('answering a confident scan is expired (409)', res.status === 409, `status=${res.status}`);

  TOKEN_UID = 'ITEST_user_outsider';
  res = await fetch(`${base}/api/v1/scans/${created.step.scanId}/answer`, { method: 'POST', headers: jsonAuth, body: JSON.stringify({ questionId: 'spot_start', optionId: 'lower' }) });
  check("outsider cannot answer someone else's scan", res.status === 409, `status=${res.status}`);
  TOKEN_UID = 'ITEST_user_scan';

  const tiny = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#2e7d32' } }).png().toBuffer();
  res = await fetch(`${base}/api/v1/scans`, { method: 'POST', headers: jsonAuth, body: JSON.stringify({ imageBase64: `data:image/png;base64,${tiny.toString('base64')}` }) });
  check('too-small photo is 400', res.status === 400, `status=${res.status}`);
```

6. The awaiting-count checks stay. The unsupported scan added above must not be counted, so make sure the expected numbers still hold.

In `ai-cache-test.ts`, switch from `openaiVision.diagnose` to `classifier.classify` and make the fake response match the classifier schema (`{ crop: 'Tomato', predictions: [...] }`).

Run: `DATABASE_URL='...' npm run test:integration --workspace=backend`. Expected: FAIL (old contract).

- [ ] **Step 2: Controller**

Replace `createScan` in `scan.controller.ts` with the code below, and add `answerScan`:

```ts
import { startDiagnosis, answerQuestion } from '../conversation/diagnosis';
import { realDeps } from '../conversation/deps';
import { checkImage } from '../conversation/filter';
import { StaleAnswerError } from '../conversation/types';

const langFor = async (userId: string) => {
  const { prisma } = require('@farmassist/database');
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { preferredLanguage: true } });
  return u?.preferredLanguage === 'sw' ? 'sw' : 'en';
};

export const createScan = async (req: Request, res: Response): Promise<any> => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { imageBase64, farmId } = req.body ?? {};
  if (farmId !== undefined && typeof farmId !== 'string') return res.status(400).json({ error: 'farmId must be a string' });
  if (farmId && !(await userCanAccessFarm(userId, farmId))) return res.status(403).json({ error: 'You do not have access to this farm' });

  const image = parseImageDataUrl(imageBase64);
  if ('error' in image) return res.status(400).json({ error: image.error });
  const quality = await checkImage(image.bytes);
  if (quality !== 'ok') return res.status(400).json({ error: quality === 'too_small' ? 'Photo is too small. Use at least 224 pixels on the short side.' : "We couldn't read that image." });

  try {
    const step = await startDiagnosis(realDeps(), { userId, farmId }, image, await langFor(userId));
    return res.status(201).json({ step });
  } catch (error) {
    console.error('Diagnosis Error:', error);
    return res.status(502).json({ error: 'Diagnosis failed. Please try again.' });
  }
};

export const answerScan = async (req: Request, res: Response): Promise<any> => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { questionId, optionId } = req.body ?? {};
  if (typeof questionId !== 'string' || typeof optionId !== 'string') return res.status(400).json({ error: 'questionId and optionId are required' });
  try {
    const step = await answerQuestion(realDeps(), { userId }, String(req.params.id), questionId, optionId, await langFor(userId));
    return res.status(200).json({ step });
  } catch (error) {
    if (error instanceof StaleAnswerError) return res.status(409).json({ error: 'expired' });
    console.error('Answer Error:', error);
    return res.status(500).json({ error: 'Failed to record your answer' });
  }
};
```

In `scan.routes.ts`, import `answerScan` and add `router.post('/:id/answer', requireAuth, answerScan);`.

- [ ] **Step 3: Remove the old path**

Delete `diagnoseAndRecord` from `scan.service.ts` (and its `openaiVision` import). Delete `openaiVision`, `Analysis` and `SYSTEM_PROMPT` from `packages/ai/index.ts`, and add `export { classifier } from './classifier';`. Then:

```bash
grep -rn "openaiVision\|diagnoseAndRecord\|Analysis\b" apps/backend/src packages/ai apps/backend/scripts
```

Expected: no matches in backend code. `apps/frontend` still references `Analysis`; Task 12 fixes that.

- [ ] **Step 4: Dashboard count**

In `dashboard.controller.ts`, change the awaiting filter to:

```ts
            prisma.scan.count({ where: { ...scanFilter, verifiedLabel: null, NOT: { diseaseName: { in: ['Unsupported crop', 'Not sure', 'Not a plant', 'Unreadable photo'] } } } }),
```

- [ ] **Step 5: Run, commit**

```bash
(cd apps/backend && npx tsc --noEmit)
npm run test:unit --workspace=backend
npm run test:ai-cache --workspace=backend
DATABASE_URL='...' npm run test:integration --workspace=backend
DATABASE_URL='...' npm run test:whatsapp --workspace=backend
git add apps/backend packages/ai
git commit -m "feat(scan): dashboard diagnosis runs on the shared pipeline; answer endpoint"
```

---

### Task 12: Dashboard UI for steps and questions

**Files:**
- Modify: `apps/frontend/src/services/scans.service.ts`
- Modify: `apps/frontend/src/features/scan/Scan.tsx`
- Modify: `apps/frontend/src/lib/scan-status.ts`, `apps/frontend/src/components/ScanStatus.tsx`
- Modify: `apps/frontend/src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `POST /scans` returns `{ step }`; `POST /scans/:id/answer` returns `{ step }` or 409.

- [ ] **Step 1: Service types**

In `scans.service.ts`, replace `Analysis` with the step types and change `diagnose`/`answer`:

```ts
export interface AdviceView {
  label: string; diseaseName: string; symptoms: string[]; treatment: string | null; prevention: string[];
  chemicals: { activeIngredient: string; pcpbReg: string }[]; source: { title: string; url: string } | null; healthy: boolean;
}
export interface DiagnosisStep {
  scanId: string; band: 'confident' | 'ask' | 'uncertain' | 'rejected'; reason: 'unsupported' | 'not_plant' | 'unreadable' | null;
  label: string | null; crop: string | null; confidence: number; advice: AdviceView | null;
  question: { id: string; text: string; options: { id: string; text: string }[] } | null;
}
// ScanRow.analysis becomes: { crop?: string; probs?: Record<string, number> } | null
  diagnose: async (imageBase64: string, farmId?: string | null): Promise<DiagnosisStep> => {
    const { data } = await apiClient.post('/scans', { imageBase64, farmId: farmId || undefined });
    return data.step;
  },
  answer: async (scanId: string, questionId: string, optionId: string): Promise<DiagnosisStep> => {
    const { data } = await apiClient.post(`/scans/${scanId}/answer`, { questionId, optionId });
    return data.step;
  },
```

- [ ] **Step 2: Status for "Not sure" and rejects**

In `lib/scan-status.ts`, change `ScanStatusKind` to `"healthy" | "disease" | "unsupported" | "uncertain"`, and in `scanStatus` add `if (/^not sure$/i.test(name)) return "uncertain";` before the unsupported check. Extend the unsupported regex to `/unsupported|not a plant|unreadable/i`. In `components/ScanStatus.tsx`, add `uncertain: "Not sure"` and `uncertain: "bg-status-neutral-bg text-status-neutral"`.

In `Dashboard.tsx`, use `scan.analysis?.crop` in place of `scan.analysis?.cropType`. Show the Confirm/Correct buttons only when `kind === "disease" || kind === "healthy"`; otherwise render `—`.

- [ ] **Step 3: Scan page**

In `Scan.tsx`:
- `result` state becomes `DiagnosisStep | null`.
- After `diagnose()` or `answer()`, refresh history with `scansService.list(activeFarmId)`.
- Replace `Result` with:

```tsx
function StepView({ step, onAnswer, busy }: { step: DiagnosisStep; onAnswer: (q: string, o: string) => void; busy: boolean }) {
  if (step.band === "rejected") {
    const text = step.reason === "unsupported"
      ? `We can't diagnose this crop yet. FarmAssist covers ${SUPPORTED_CROPS.join(", ")}.`
      : step.reason === "not_plant" ? "We couldn't see a plant. Try a close photo of one leaf." : "We couldn't read that photo. Try another, in daylight.";
    return (<div><StatusBadge kind="unsupported" /><p className="mt-3 text-sm">{text}</p></div>);
  }
  if (step.band === "uncertain") {
    return (<div><StatusBadge kind="uncertain" /><h2 className="mt-3 text-lg font-semibold">Not sure yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">We couldn't tell with enough confidence. An expert will look at your photo.</p></div>);
  }
  if (step.band === "ask" && step.question) {
    return (
      <div>
        <StatusBadge kind="uncertain" />
        <h2 className="mt-3 text-lg font-semibold">{step.question.text}</h2>
        <p className="mt-1 text-sm text-muted-foreground">One detail helps tell two look-alike diseases apart.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {step.question.options.map((o) => (
            <Button key={o.id} variant="outline" disabled={busy} onClick={() => onAnswer(step.question!.id, o.id)}>{o.text}</Button>
          ))}
        </div>
      </div>
    );
  }
  const a = step.advice!;
  const confidence = Math.round(step.confidence * 100);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge kind={a.healthy ? "healthy" : "disease"} />
        {step.crop && <span className="text-xs text-muted-foreground">{step.crop}</span>}
      </div>
      <h2 className="mt-2 text-lg font-semibold">{a.diseaseName}</h2>
      <div className="mt-3">
        <div className="flex justify-between text-xs text-muted-foreground"><span>Confidence</span><span className="tabular">{confidence}%</span></div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground/70" style={{ width: `${confidence}%` }} /></div>
      </div>
      <div className="mt-5 space-y-4 text-sm">
        {a.symptoms.length > 0 && <Block title="Signs"><ul className="list-disc space-y-0.5 pl-5">{a.symptoms.map((s) => <li key={s}>{s}</li>)}</ul></Block>}
        {a.treatment ? <Block title="What to do"><p className="leading-relaxed">{a.treatment}</p></Block>
          : !a.healthy && <Block title="What to do"><p>Ask your agrovet for treatment.</p></Block>}
        {a.chemicals.length > 0 && <Block title="Registered active ingredients">
          <p>{a.chemicals.map((c) => c.activeIngredient).join(", ")}. Ask your agrovet for the right product and dose.</p></Block>}
        {a.prevention.length > 0 && <Block title="Prevention"><ul className="list-disc space-y-0.5 pl-5">{a.prevention.map((p) => <li key={p}>{p}</li>)}</ul></Block>}
        {a.source && <p className="text-xs text-muted-foreground">Source: <a className="underline underline-offset-2" href={a.source.url} target="_blank" rel="noreferrer">{a.source.title}</a></p>}
        <p className="text-xs text-muted-foreground">This is advice, not a guarantee. Ask your agrovet before spraying, especially if symptoms spread.</p>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div><h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3><div className="mt-1">{children}</div></div>);
}
```

- Render the existing `Feedback` component under `StepView` only when `step.band === "confident"`. It now needs the scan row's verification state: pass `scanId` and keep a local `verified` boolean instead of a `ScanRow`, and call `scansService.verify(scanId, ...)`.
- `onAnswer` calls `scansService.answer(step.scanId, q, o)`. A 409 response shows the toast "That question expired. Diagnose the photo again." and clears `result`.

- [ ] **Step 4: Build, check in the browser, commit**

```bash
npm run build --workspace=vite_react_shadcn_ts
(cd apps/frontend && npx tsc --noEmit -p tsconfig.app.json)
```

Expected: the build succeeds, and tsc shows only the existing `App.tsx` `future` error. Run the Playwright pass from the redesign: Auth emulator, backend, then Vite with `VITE_FIREBASE_AUTH_EMULATOR_HOST`. Check:
1. A tomato photo shows the result with "Signs" and the no-advice line, until Task 13 sources the entry.
2. A maize photo shows the unsupported text.
3. The dashboard shows "Not sure" scans without Confirm or Correct.

```bash
git add apps/frontend
git commit -m "feat(frontend): show pipeline steps, questions and sourced advice"
```

---

### Task 13: Source the priority knowledge and questions

**Files:**
- Modify: `packages/ai/crop-knowledge.json` (priority labels)
- Modify: `packages/ai/questions.json` (sources)

This is a content task with a hard gate. Nothing ships without a verified citation, and the integrity tests enforce it. Do the labels in this order:
1. `Tomato___Late_Blight`
2. `Tomato___Early_Blight`
3. `Potato___Late_Blight`
4. `Potato___Early_Blight`
5. `Coffee___Rust`
6. `Tomato___Septoria_Leaf_Spot`

- [ ] **Step 1: For each label, find and verify a source**

Use sources in this order of preference:
1. CABI PlantwisePlus factsheets or pest management decision guides for Kenya (`plantwiseplusknowledgebank.org`)
2. KALRO
3. Coffee Research Institute (for coffee)
4. A university extension service, such as UMN or UC IPM

Open the page with WebFetch and confirm it describes this disease on this crop. Record its exact title and https URL.

- [ ] **Step 2: Write the entry from the source only**

- `treatment` and `prevention` in English: paraphrase the source's cultural and management guidance.
- No doses (`DOSAGE_RE` will catch them).
- `chemicals`: add an item only if the source names the active ingredient **and** you find a current PCPB registration for a product containing it on `pcpb.go.ke`. Record the registration number in `pcpbReg`. If you can't verify a registration, leave `chemicals: []`. The reply then says to ask the agrovet, which is safe.
- `sw`: translate `diseaseName`, `symptoms`, `treatment` and `prevention`. Note in the PR that a fluent speaker must review the Swahili before launch.
- `source`: `{ "title": "...", "url": "https://..." }`.
- Leave `reviewed: false`.

- [ ] **Step 3: Source the question pairs**

For each pair in `questions.json`, cite the page whose text supports both questions and their option weights:
- The Early vs Late blight pairs need an extension page that compares where on the plant each starts and the weather that favours it.
- The Septoria vs Early blight pair needs a page describing Septoria's small pale-centred spots.

Set `source`. If a question isn't supported by the source, delete that question and keep 1–2 per pair.

- [ ] **Step 4: Gate and suites**

```bash
npm run test:unit --workspace=backend
npm run test:ai --workspace=backend
(cd AImodel && python -m unittest discover -s tests)
DATABASE_URL='...' npm run test:whatsapp --workspace=backend
DATABASE_URL='...' npm run test:integration --workspace=backend
```

Expected: all pass. The WhatsApp question-flow checks from Task 10 now run instead of being skipped, because a sourced pair exists.

- [ ] **Step 5: Commit**

```bash
git add packages/ai/crop-knowledge.json packages/ai/questions.json
git commit -m "content(ai): cite sources for priority diseases and look-alike questions"
```

---

### Task 14: Final verification

- [ ] **Step 1: Full suite**

```bash
npm run test:unit --workspace=backend
npm run test:ai --workspace=backend
npm run test:ai-cache --workspace=backend
(cd AImodel && python -m unittest discover -s tests)
DATABASE_URL='...' npm run test:whatsapp --workspace=backend
DATABASE_URL='...' npm run test:integration --workspace=backend
(cd apps/backend && npx tsc --noEmit)
npm run build --workspace=vite_react_shadcn_ts
npm run lint --workspace=vite_react_shadcn_ts
```

Expected: everything passes, and lint shows no new errors compared with `main`.

- [ ] **Step 2: Live check against a real WhatsApp test number**

Only with the user's go-ahead: this sends real messages.
1. Run the backend with the WhatsApp env set.
2. From the test phone, send a tomato leaf photo. Expect a diagnosis or a question with buttons.
3. Tap a button. Expect a resolution.
4. Send "habari". Expect the help reply.
5. Send "STOP", then a photo. Expect silence.

- [ ] **Step 3: Open the PR**

```bash
git push -u origin feat/diagnosis-pipeline
gh pr create --base main --title "Diagnosis pipeline: closed-label classifier, guardrails, WhatsApp replies" --body "Implements Plan 2A (docs/superpowers/plans/2026-10-06-diagnosis-pipeline.md). Launch items: Swahili review of i18n.ts and KB sw blocks; agronomist audit of the sourced entries."
```
