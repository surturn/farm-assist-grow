# Conversational Diagnosis Core — Design Spec

**Date:** 2026-10-06
**Status:** Approved for planning
**Depends on:** [Strip to Core](./2026-10-06-strip-to-core-design.md) (must land first)
**Related:** [WhatsApp Channel Design](./2026-08-10-whatsapp-channel-design.md),
[Local-First Crop Diagnosis](./2026-08-06-local-first-crop-diagnosis-design.md),
`docs/agronomist-market-review.md`

---

## 1. Intent

The product is a chatbot inside apps farmers already use. The channel is only transport:
WhatsApp first, Telegram second, and USSD parked (see §9). The finished AI product is a **ReAct
agent**: it reasons, acts through tools, observes the results, and replies.

Work proceeds in a fixed order, and **no model training starts until every earlier gate
passes**:

1. **Wire the architecture**: channel adapters, a channel-neutral conversation core, and the
   tools.
2. **Unit tests** for the architecture and the AI path.
3. **Context filter, output checker, guardrails and rules.**
4. **Faithful eval**: measure the whole pipeline and record a baseline.
5. **Phase B**: swap the deterministic orchestrator for a ReAct agent, which must match the
   baseline.
6. **Train the local model** (Local-First spec). It must beat the baseline on the same eval.

Steps 1–4 are Phase A. Step 5 is Phase B. Both are in this spec. Step 6 is not.

### Design principle: the model classifies, code decides, the KB speaks

- The **classifier** only returns a label from a closed list, plus a confidence score. It never
  writes advice.
- **Rules in code** decide what happens at each confidence level. Prompt instructions are not
  relied on for this.
- **All farmer-facing advice** (treatment, prevention, chemicals, doses) comes from the
  source-cited knowledge base (KB). A model, whether OpenAI, the local classifier or the
  agent, can never introduce a chemical or a dose.

Swapping OpenAI for the local classifier changes nothing downstream. Swapping the orchestrator
for the agent changes control flow, not what the farmer can be told.

### Success criteria

- A farmer sends a crop photo on WhatsApp and receives a diagnosis, or one or two tap-to-answer
  questions followed by a diagnosis, or an honest "not sure, an expert will check". All replies
  are in Swahili or English.
- Every reply that names a disease, chemical or dose can be traced to a tool observation from
  the same turn. The checker enforces this, and the eval measures it.
- Unit tests cover every component in §3 and pass in CI with no network access.
- The eval produces a baseline report: per-class accuracy, calibration, abstention rate, checker
  rejection rate, and the accuracy gap between original and WhatsApp-compressed images.
- Confidence thresholds are taken from the eval's calibration data, not guessed.

## 2. Supported crops and labels

Tomato, potato, pepper, cashew and coffee. The closed label list lives in one file,
`packages/ai/kb/labels.json`, keyed by crop:

| Crop | Labels | Source |
|---|---|---|
| Tomato | Bacterial_Spot, Early_Blight, Healthy, Late_Blight, Leaf_Mold, Mosaic_Virus, Septoria_Leaf_Spot, Target_Spot, Yellow_Leaf_Curl_Virus | existing merged dataset |
| Potato | Early_Blight, Healthy, Late_Blight | existing |
| Pepper | Bacterial_Spot, Healthy | existing |
| Cashew | Anthracnose, Gummosis, Healthy, Leaf_Miner, Red_Rust | existing |
| Coffee | Cercospora, Phoma, Rust, Healthy*, Leaf_Miner* | `AImodel/external/JMuBEN` |

\* The local JMuBEN copy has no Healthy or Leaf_Miner folders; JMuBEN2 has both. The labels
exist so that the OpenAI classifier and the eval can use them. Local training needs JMuBEN2.

**Coffee Berry Disease** is Kenya's most damaging coffee disease, but it shows on berries, not
leaves, and no leaf dataset covers it. It is left out of the label list and listed as an open
question for the agronomist. Until it is resolved, a berry photo goes to the rules as low
confidence and gets flagged for review.

`labels.json` is the only source of label names. The classifier's output schema, the checker,
the KB and the eval all read it.

## 3. Architecture

```
 WhatsApp / Telegram
        │ webhook
        ▼
 adapter.parse()  ──▶  InboundMessage (channel-neutral)
        │
        ▼
 context filter  ──reject──▶ fixed reply
        │ pass
        ▼
 orchestrator (Phase A: deterministic · Phase B: ReAct agent)
        │ calls tools
        ├── classify_image   → classifier (OpenAI now, local later) → checker → capture
        ├── ask_farmer       → question bank
        ├── get_advice       → KB
        ├── get_farm_context → own channel/farm only
        └── flag_for_review
        ▼
 output checker (faithfulness)  ──fail──▶ fixed safe reply
        │ pass
        ▼
 renderer (i18n)  ──▶  adapter.send()
```

### 3.1 Channel contract

`apps/backend/src/conversation/types.ts` defines:

```ts
type InboundMessage = {
  channel: 'whatsapp' | 'telegram';
  externalUserId: string;      // WA phone (E.164) or Telegram chat id
  externalMessageId: string;   // idempotency key, unique per channel
  kind: 'image' | 'button' | 'text' | 'command' | 'unsupported';
  fetchImage?: () => Promise<Buffer>; // lazy: media is downloaded only after the filter passes the message metadata
  buttonId?: string;
  text?: string;
  command?: 'stop' | 'start' | 'help' | 'language';
};

type OutboundMessage = {
  key: string;                         // i18n key, e.g. 'diagnosis.result'
  params?: Record<string, string>;
  buttons?: { id: string; key: string }[]; // at most 3 (the WhatsApp reply-button limit)
};
```

An adapter has two functions: `parse(webhookPayload) → InboundMessage[]` and
`send(channel, OutboundMessage[])`. The adapter also does the rendering into the farmer's
language, because button title length limits differ per channel (WhatsApp allows 20
characters, Telegram 64). Nothing past the adapter knows which channel it is on.

The existing WhatsApp pipeline (signature check, queue, worker, idempotency, channel events) is
kept. `intent.router.ts` becomes the WhatsApp adapter's `parse`. The worker calls the core
instead of logging "no handler yet". Commands (stop, start, language) stay as they are.

**WhatsApp outbound (new):**
- `POST /{phone-number-id}/messages`, sending text and interactive reply-button messages.
- Media is downloaded via `GET /{media-id}` followed by the media URL.
- Every send records an OUTBOUND `ChannelEvent`.
- Sending is refused if `lastInboundAt` is more than 24 hours old. The rule is enforced in code,
  as the WhatsApp channel spec requires.

### 3.2 Channel-neutral schema

| Model | Change |
|---|---|
| `FarmerChannel` | add `channel String`, add `externalId String`, `@@unique([channel, externalId])`; `phone` becomes nullable (Telegram has no phone by default) |
| `Scan`, `FarmNote`, `ChannelEvent` | `waMessageId` renamed to `externalMessageId`; the global `@unique` becomes `@@unique([channelId, externalMessageId])` |
| `Scan` | add `answers Json?` (question id → answer id), add `trace Json?` (orchestrator or agent steps, §6) |

This is applied with `prisma db push`. The WhatsApp channel has never been live (it is blocked on
Meta verification), so these columns hold only test data. Dump the database first, as in
Strip to Core.

### 3.3 Tools

Tools are plain async functions in `apps/backend/src/conversation/tools/`. Each has a typed input
and output and checks permissions itself. The Phase A orchestrator calls them directly. In
Phase B the agent calls the same functions through tool definitions generated from the same
types.

| Tool | Input | Output | Hard rules inside the tool |
|---|---|---|---|
| `classify_image` | image buffer, optional answer ids | `{crop, label, confidence, top2, band}` or `{band:'rejected', reason}` | Runs the classifier, then the checker (§4.2), then computes the band (§4.3). Captures the training example via `scanService` on every call (Strip to Core §4.1). |
| `ask_farmer` | `top2` labels | the question for that pair, or none | Questions come only from `questions.json`. At most 2 questions per scan. |
| `get_advice` | label, language | KB entry, with unsourced fields removed | Returns only fields that pass the provenance gate (§4.4). |
| `get_farm_context` | channel id | crops, region, recent scans | Can only read the calling channel and its linked user's farms. |
| `flag_for_review` | scan id | ok | Sets `reviewStatus = 'PENDING'`. |

### 3.4 Conversation state

A pending question is held in Redis at `conv:<channelId>`, holding `{scanId, imageKey,
asked[]}`, with a 24-hour TTL to match the WhatsApp service window. If the key is lost, the
farmer's next tap gets "please send the photo again". Answers are written to `Scan.answers` as
they arrive, so the training example keeps them even if Redis loses the key.
`// ponytail: Redis TTL state; move to a table if conversations need to survive longer than a day.`

### 3.5 Phase A orchestrator (deterministic)

```
image → classify_image
  band=confident  → get_advice → reply(diagnosis + advice)
  band=ask        → ask_farmer(top2) → (answer) → classify_image(image, answers) → re-band
                     at most 2 questions; then confident → reply, otherwise → uncertain path
  band=uncertain  → flag_for_review → reply("not sure, an expert will check")
  band=rejected   → reply(reason: not a plant / unsupported crop / unreadable photo)
text  → reply(help: "send a photo of the sick leaf")
```

This is about 60 lines in a single function. It is the reference behaviour the agent has to
match.

### 3.6 Phase B: ReAct agent

The orchestrator is replaced by a Thought → Action → Observation loop over the same tools.

- **Step cap:** 6 tool calls per turn. Hitting the cap produces the fixed safe reply and
  `flag_for_review`.
- **Bands are binding:** the agent sees the `band` returned by `classify_image`. The output
  checker rejects any reply that states a diagnosis when the band is `uncertain`.
- **Free text is allowed only through the context filter:** the agent can answer on-topic
  follow-ups such as "can I still sell these tomatoes?", but only with facts from tool
  observations.
- **Model choice:** the agent's LLM is chosen by running the eval (§5). The planning step for
  Phase B uses the provider's current documentation.
- **Phase B ships only when** it matches or beats the Phase A baseline on accuracy and
  abstention correctness, has zero faithfulness violations on the eval set, and stays within
  the per-turn cost budget recorded in the baseline report.

## 4. Guardrails

### 4.1 Context filter (before any model)

- **Allowed kinds:** image, button and command, plus text in Phase B. Everything else gets a
  fixed reply.
- **Image checks:**
  - It must decode (`sharp` is already installed).
  - The shortest side must be at least 224 px.
  - It must be no larger than 10 MB.
  - `// ponytail: no blur detection; add a Laplacian-variance check if the eval shows blurry photos are a failure mode.`
- **Button checks:** the button id must belong to the question currently pending for this
  channel. Stale or forged ids are rejected.
- **Text checks (Phase B):**
  - At most 500 characters.
  - On topic: one cheap classification call that returns `{onTopic: boolean}`.
  - Injection screen: the text is passed to the agent as data inside a delimited user block,
    never concatenated into instructions. Text matching known injection patterns is rejected.
- **Opted-out channels** get nothing beyond the opt-out confirmation, as the WhatsApp spec
  already requires.

### 4.2 Output checker

The checker runs at two points.

**After the classifier**, inside `classify_image`:
- Validate the output with zod against the schema.
- `crop` must be in `labels.json`.
- `label` must be in that crop's list.
- `confidence` must be in [0, 1].
- Any failure gives `band: 'rejected'`. The OpenAI classifier also uses `response_format`
  `json_schema` with enums generated from `labels.json`, so the schema is enforced twice.

**Before sending** (faithfulness):
- Every label, chemical name and dose in the outgoing reply must appear in this turn's tool
  observations.
- In Phase A this holds by construction, because the reply is assembled from tool outputs, and
  the check is a cheap assertion.
- In Phase B it is a real check. A failure gets one retry with the violation in the error
  message; a second failure sends the fixed safe reply and flags the scan.

### 4.3 Rules (code, not prompt)

- **Bands:** `confident` when confidence ≥ `T_HIGH`; `ask` when `T_LOW` ≤ confidence <
  `T_HIGH` and the top-2 pair has a question; `uncertain` otherwise.
  - Starting values are `T_HIGH = 0.85` and `T_LOW = 0.5`.
  - These are replaced by values from the eval's calibration: `T_HIGH` becomes the lowest
    confidence at which accuracy on the eval set is at least 90%.
  - Both live in `packages/ai/rules.ts` as the calibration knob.
- **Healthy:** a `Healthy` label never comes with treatment advice.
- **No sourced advice for a label:** the reply gives the label and says "ask your agrovet for treatment".
  It never falls back to model-written advice.
- **Unsupported crop or no plant:** a fixed reply. The image is still captured.
- **Wording:** a diagnosis reply always ends with the same short line saying this is advice and
  to consult an agrovet if symptoms spread.

### 4.4 Knowledge base

The KB lives in `packages/ai/kb/` and is versioned in git:

- `labels.json`: the closed label list (§2).
- `advice.json`: one entry per label, holding `description`, `cultural[]` (non-chemical
  practices) and `chemical[]` in both `sw` and `en`.
  - Every entry carries `source`: a URL and title for the publication it is drawn from.
  - Every chemical item also carries the product name, active ingredient, dose as published,
    and `pcpbReg`, its Kenya Pest Control Products Board registration number.
  - `agronomistReviewed` (a date or null) records post-launch audits. It does not gate anything.
- `questions.json`: per look-alike label pair, 1–2 questions with up to 3 answer options, each
  answer weighted toward one label of the pair, plus a `source`.
  - Example: Early_Blight vs Late_Blight is separated by timeline (when symptoms appeared
    relative to flowering and fruiting), rate of spread, and recent cool, wet weather.

**Provenance gate, not a sign-off gate.** Content ships when it can be traced to an authoritative
source. It does not wait for one reviewer's calendar. Sources, in order of preference: CABI
PlantwisePlus pest management decision guides for Kenya, KALRO factsheets, Coffee Research
Institute guides for coffee, and the PCPB registered-product list for chemicals. Claude drafts the
entries from these, and the gate is enforced by the KB integrity test (§6), not by review.

| Content | Sent when |
|---|---|
| Disease name and description | the label is in `labels.json` |
| Cultural practices | the entry has a `source` |
| Chemical product, active ingredient, dose | the entry has a `source` **and** the item has a `pcpbReg` |
| Any field without provenance | never; the reply falls back to "ask your agrovet for treatment" |
| A question for a look-alike pair | the question has a `source`. A pair with no sourced question goes straight to `uncertain`. |

The dose is reproduced exactly as published; it is never computed or converted. The agronomist
becomes an auditor rather than a gate. They spot-check entries after launch, starting with the
labels that get the most traffic (the tomato and potato blights), and review flagged scans. A
correction they make goes into `advice.json` like any other change and is judged against the
eval.

## 5. Faithful eval

`apps/backend/scripts/eval/` is a TypeScript script that runs the **real pipeline**: filter →
tools → orchestrator → checker. It does not call the classifier on its own.

- **Data:**
  - The test split of `AImodel/KenyaCropDisease` filtered to the 5 crops, plus a held-out slice
    of JMuBEN.
  - Up to 30 images per label, sampled with a fixed seed.
  - The image list is committed as a manifest; the images are not committed.
- **Variants:** each image is run as the original and as a WhatsApp-like re-encode (longest side
  1600 px, JPEG quality 80, via `sharp`).
  - `// ponytail: simulated WhatsApp compression; calibrate by sending 20 real photos through a WhatsApp test number and comparing their bytes and accuracy with the simulation.`
- **Simulated answers:** for images that reach `ask`, a scripted farmer answers from the image's
  true label. This tests whether the questions actually separate the look-alike pairs.
- **Report** (`eval-report.json` plus a short markdown summary):
  - Per-label accuracy and confusion pairs.
  - Calibration: reliability per band and ECE. The recommended `T_HIGH` and `T_LOW` come from
    this.
  - Abstention rate and abstention correctness (how many of the abstentions would have been
    wrong answers).
  - Question lift: accuracy before vs after the questions.
  - Accuracy gap between original and compressed images. **Gate: no more than 3 percentage
    points**, otherwise the local model training must add JPEG augmentation before it ships.
  - Checker rejection rate and faithfulness violations. **Gate: 0 faithfulness violations.**
  - Cost and latency per turn.
- **Cost:** about 20 labels × 30 images × 2 variants is roughly 1,200 classifier calls, plus
  re-diagnoses. Results are cached by image hash, so re-runs are cheap.
- **Phase B** adds trajectory scoring: the right tools in a sensible order, a question asked
  when the band was `ask`, and never a diagnosis when the band was `uncertain`.
- The baseline report is committed. Every later change to the classifier, rules, KB or agent
  is judged against it.

## 6. Unit tests

Tests use `node:test` and `node:assert` from the Node standard library, run with `tsx`, which
is already a dev dependency. There are no network calls: the classifier, the WhatsApp HTTP API
and Redis are faked.

| Area | Covers |
|---|---|
| Adapters | WhatsApp payload → `InboundMessage` for image, button, text, commands and unsupported types; `send` builds valid interactive payloads; the 24-hour window refusal |
| Context filter | each rejection reason; a stale or forged button id; an opted-out channel |
| Checker | an out-of-list label; a crop/label mismatch; malformed JSON; confidence out of range; faithfulness pass and fail |
| Rules | band edges at exactly `T_HIGH` and `T_LOW`; Healthy gets no advice; label with no sourced advice |
| Tools | `classify_image` captures a scan on every path, including rejected; `get_farm_context` refuses another channel's farm; `ask_farmer` cap of 2 |
| Orchestrator | every branch in §3.5 with a fake classifier; Redis key lost mid-conversation |
| KB integrity | every label has an advice entry and appears in `labels.json`; every question pair refers to real labels; every answer option has a translation in both languages; **every advice entry and question has a `source`, and every chemical item has a `pcpbReg`** — otherwise the build fails |

The `trace` stored on each Scan (a list of tool name, input summary and output summary) is
written in Phase A as well, so the Phase B trajectory tests and the eval read one format.

## 7. Delivery order

1. Strip to Core (separate spec).
2. Schema change (§3.2), the conversation types, the WhatsApp adapter refactor and the outbound
   sender.
3. KB files with draft content, tools, the Phase A orchestrator, and the worker wired to the
   core. The dashboard's `POST /scans` moves onto `classify_image` and `get_advice` in the same
   step, so no surface keeps showing model-written advice. Confidence is normalised to [0, 1];
   the OpenAI 0–100 score is divided by 100 inside its classifier implementation.
4. Unit tests (§6), written with each component.
5. Context filter, checker and rules hardened to §4.
6. Eval harness, the first baseline, thresholds set from calibration, and the baseline
   committed.
7. Telegram adapter (Bot API webhook, inline keyboards). The core does not change.
8. Phase B: the ReAct agent passes the §3.6 gate.
9. Local model training (Local-First spec, updated for the 5-crop label list) passes the eval
   gate.

## 8. Risks

- **Published guidance can be stale or generic.** A Plantwise or KALRO guide may lag behind new
  registrations or local resistance patterns. Mitigations: the PCPB registration number is
  checked against the current register when an entry is added, the agronomist audits the
  highest-traffic labels first, and every reply ends with the "consult an agrovet" line (§4.3).
- **Source coverage gaps.** Some labels (for example cashew gummosis, or the coffee Phoma
  disease) may have no Kenya-specific guide. Those labels ship with a description only, and the
  missing sources are listed in the KB drafting task's output.
- **Simulated answers are optimistic.** Scripted answers are always correct, and real farmers'
  answers will be noisier. Question lift on the eval is an upper bound. Track the real lift from
  `Scan.answers` once farmers start verifying scans.
- **The eval set comes from public datasets, not field photos.** Its accuracy flatters field
  performance. The verified-data flywheel (Strip to Core §4.1) is what eventually replaces it
  with a field eval set.
- **Meta verification** still gates real WhatsApp traffic. Everything up to the eval runs
  without it, against fixtures and a test number.

## 9. Out of scope

- **USSD.** It cannot carry images, so it would need a question-only, text-menu diagnosis. That
  is a different product path, designed once the image channels pass eval.
- The agronomist review queue UI.
- Proactive outbound alerts (WhatsApp spec, Milestone 5), which need approved templates.
- Model training itself (Local-First spec, step 9 above).
