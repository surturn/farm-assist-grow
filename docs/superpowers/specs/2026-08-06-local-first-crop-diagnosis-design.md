# Local-First Crop Diagnosis — Phase 1 Design

**Date:** 2026-08-06
**Status:** Draft, pending review
**Scope:** Phase 1 of 5 (see [Roadmap](#roadmap-context))

## Problem

Every crop scan currently calls OpenAI vision (`packages/ai/index.ts`), cached in Redis by
image hash. Each scan costs money and takes ~2s, and the system is unavailable whenever the
OpenAI API is. The `AImodel/` directory already holds a merged 30-class crop disease dataset
and a GPU-capable Python environment, but no model has been trained.

## Goal

Train a crop disease classifier, serve it locally, and make it the **default resolver** for
every scan. OpenAI becomes the fallback for low-confidence cases and for inference failures,
not the primary path.

Success for Phase 1:

- A trained classifier with a **trustworthy** held-out accuracy number
- Local inference p95 < 500ms on CPU
- High-confidence scans answered with zero API calls
- No changes required in the frontend, `scan.controller.ts`, or the `Scan` Prisma model

## Architecture

```
Frontend  ──POST /api/v1/scans/analyze──▶  Node backend (packages/ai)
                                                │
                                    1. Redis cache check (existing, unchanged)
                                                │
                                    2. POST image ──▶ [NEW] Python inference service
                                                            YOLO11s-cls → {label, confidence}
                                                │
                                    3. confidence >= THRESHOLD ?
                                         ├─ yes ─▶ [NEW] crop-knowledge.json → build response
                                         └─ no  ─▶ OpenAI vision (existing path, unchanged)
                                                │
                                    4. Cache + return the same JSON shape as today
```

| Component | Location | Purpose |
|---|---|---|
| Training pipeline | `AImodel/` | Re-merge with group-aware split, train, evaluate, export |
| Inference service | `apps/inference/` | FastAPI + ultralytics, `POST /predict`, new compose service |
| Knowledge table | `packages/ai/crop-knowledge.json` | 30 classes → symptoms, causes, treatment, prevention |
| Resolver | `packages/ai/index.ts` | Orchestrates local-first → OpenAI fallback |

**Contract that keeps everything else working:** `analyzeCropImage()` keeps its current return
shape. The signature gains an options object — `analyzeCropImage(imageBase64, { tenantId, farmId })`
— and the confidence threshold is a parameter with an env default, so Phases 2 and 4 are
additive rather than rewrites.

**The local model is an optimization, never a hard dependency.** A dead inference container
degrades cost, not availability.

## Existing state

Verified in the repo as of this design:

- **Dataset:** `AImodel/KenyaCropDisease/` — 109,202 train / 13,640 val / 13,673 test images,
  30 classes, folder-per-class (ultralytics classification layout)
- **Environment:** `AImodel/venv` with torch 2.11+cu130, torchvision, ultralytics 8.4.33;
  training hardware is an RTX 2060 (6GB VRAM)
- **Multi-tenancy:** `Tenant`, `TenantUser`, `TenantType`, and `Farm.tenantId` already exist
  (`apps/backend/prisma/schema.prisma:39-74`). **`Scan` has no `tenantId`** (line 114) and
  **`Tenant` has no `plan` field** — both are Phase 2 gaps, out of scope here.
- **Compose:** postgres, redis, backend, frontend. The inference service is a fifth service.

## Data quality: the leakage problem

The current `merge_datasets.py` pools each source's own train and valid folders, then
re-splits randomly by **file**. Both `PlantDoc2` and the CCMT source are *augmented* datasets
where one physical leaf appears as several derived images.

Concrete evidence — the same original photo, split across folders in the source itself:

```
train/Tomato___Late_blight/005e3b43-...___RS_Late.B 5104_flipLR.JPG
valid/Tomato___Late_blight/005e3b43-...___RS_Late.B 5104.JPG
```

After the random re-split, flipped and rotated siblings of the same leaf land in train **and**
val **and** test.

**Why this blocks Phase 1:** the model is scored on images it effectively memorized, so val
accuracy is inflated. The whole design hinges on a confidence threshold deciding when to skip
OpenAI — a mis-calibrated model would confidently serve wrong diagnoses with no fallback.
The evaluation number is load-bearing.

**Fix:** the UUID prefix before `___` is a stable per-original-image ID, so siblings are
groupable. CCMT also ships a non-augmented `Raw Data/` folder.

## Training pipeline

Four scripts in `AImodel/`, run in order, each independently re-runnable.

### 1. `merge_datasets_v2.py`

Replaces the current merge. Output goes to `KenyaCropDisease_v2/` so the existing dataset
stays intact until the new one is verified.

- **Group-aware split:** derive a group key per image (PlantDoc2 → UUID prefix before `___`;
  CCMT → source filename stem), then split *groups* 80/10/10 — never files.
- **CCMT from `Raw Data/`** instead of `CCMT Dataset-Augmented/`.
- Prints per-class **group** counts, exposing class imbalance the current file-count summary
  hides.

### 2. `verify_dataset.py`

Hard gate before training:

- Asserts zero group-key overlap between train/val/test
- Reports per-class counts per split
- Flags any class under ~50 training groups as too thin to learn

Fails loudly rather than letting a silent leak through.

### 3. `train.py`

Ultralytics classification; config constants at the top of the file.

| Run | Model | Epochs | Settings | Purpose |
|---|---|---|---|---|
| Smoke | `yolo11n-cls` | 3 | `fraction=0.05` | Prove the pipeline end to end (~10 min) |
| Real | `yolo11s-cls` | ~30 | 224px, batch 64, `patience=8`, AMP | Production model |

Ultralytics reads classes from folder names for classification, so `data.yaml` is unused on
this path. `generate_yaml.py` becomes dead code — left in place, not deleted.

### 4. `evaluate.py`

Produces the numbers that drive the design:

- Top-1 / top-5 on the held-out test split
- 30×30 confusion matrix
- Per-class precision and recall
- **Confidence-vs-accuracy curve** — sets the threshold empirically rather than guessing 0.70

Exports `best.pt` to `apps/inference/models/`.

**Expected outcomes, named in advance so they aren't mistaken for bugs:**

- Test accuracy will drop noticeably versus the leaky split. That is the honest number, not a
  regression.
- Class imbalance is likely severe (Cashew from one source, Tomato from three). Classes that
  never clear a usable threshold simply always route to OpenAI — implying a per-class
  threshold table rather than one global number. `evaluate.py` provides the data to decide.

## Inference service

New app at `apps/inference/`, a fifth compose service.

```
apps/inference/
  main.py           # FastAPI app, 2 endpoints
  predictor.py      # model load + preprocess + predict
  models/best.pt    # trained weights (~10MB, committed)
  requirements.txt  # fastapi, uvicorn, ultralytics, pillow
  Dockerfile
```

### API

Deliberately narrow — the service classifies images and knows nothing about tenants, farms,
treatments, or OpenAI.

```
POST /predict   { "image": "<base64>" }
             →  { "label": "Maize___Northern_Leaf_Blight",
                  "confidence": 0.94,
                  "top5": [{label, confidence}, ...],
                  "inference_ms": 187 }

GET  /health →  { "status": "ok", "model": "yolo11s-cls", "classes": 30 }
```

`top5` is free to return and leaves room for margin-based confidence or "did you mean?"
without a service change.

### Operational decisions

- **Model loads once at startup**, held in module state. Cold load is ~2s; per-request loading
  would blow the 500ms p95 target. `/health` reports unhealthy until loaded, so compose's
  `depends_on: service_healthy` gates the backend correctly.
- **CPU inference by default.** The RTX 2060 is for training; production has no GPU. YOLO11s-cls
  at 224px runs ~50–150ms per image on CPU. **Benchmark on CPU, not the training card.**
- **Preprocessing lives in Python**, using the same ultralytics transforms as training. This is
  the entire reason for a Python service over ONNX-in-Node: no train/serve preprocessing
  mismatch silently degrading accuracy.
- **Not included:** auth, rate limiting, caching. Those belong to the backend, which already
  holds Redis and tenant context.

## Knowledge table

`packages/ai/crop-knowledge.json` — 30 entries keyed by the exact class label the model emits,
so lookup is a direct index with no fuzzy matching.

```json
{
  "Maize___Northern_Leaf_Blight": {
    "diseaseName": "Northern Leaf Blight (Exserohilum turcicum)",
    "cropType": "Maize",
    "symptoms": ["...", "...", "..."],
    "possibleCauses": ["fungal infection", "..."],
    "treatment": "…cultural and chemical guidance…",
    "prevention": ["...", "...", "..."],
    "reviewed": false
  }
}
```

**Deliberate choices:**

- **`severity` is absent.** The model returns a label, not a severity assessment, so the local
  path returns `"severity": "Unknown"`. Fabricating severity is exactly the confident-wrong
  output that costs a farmer a spray cycle.
- **`reviewed: false`** on every entry until an agronomist signs off — draft status lives in
  the data, not in a commit message.
- **Treatment text names active ingredients and cultural practices but defers dosages** to
  local agricultural extension services. No invented mixing rates.

A **startup assertion** verifies every one of the model's 30 class names has an entry, so a
class/table mismatch fails at boot rather than at 2am on a farmer's scan.

Content is drafted by Claude and requires agronomy review before shipping to farmers.

## Resolver

Flow in `packages/ai/index.ts`:

```
analyzeCropImage(imageBase64, { tenantId, farmId })
  1. size validation (existing, unchanged)
  2. hash → Redis cache check (existing, unchanged)
  3. POST inference service, 2s timeout
       ├─ ok + confidence >= threshold → knowledge table → response, source:"local"
       ├─ ok + confidence <  threshold → OpenAI (existing path), source:"openai"
       └─ error/timeout                → log, OpenAI,           source:"openai_fallback"
  4. cache + return
```

**Response shape** is byte-identical to today plus three additive fields: `source`,
`confidence`, `processing_ms`. Frontend and `scan.controller.ts` need no changes.
`confidence` already exists in the OpenAI response as 0–100; the local path scales its 0–1
softmax to match, so downstream code sees a single scale.

**Threshold config:** `LOCAL_CONFIDENCE_THRESHOLD` env var, defaulted from `evaluate.py`'s
confidence curve. If per-class thresholds prove necessary, they go in `crop-knowledge.json`
as an optional `threshold` field overriding the global.

**Cache key** stays `crop_analysis:${imageHash}` — content-addressed, results shared across
tenants. See [Risks](#risks).

## Error handling

| Failure | Behavior |
|---|---|
| Inference service down / timeout / 5xx | Log with `source:"openai_fallback"`, route to OpenAI. Not user-visible. |
| Inference OK, class missing from knowledge table | Caught at boot by the startup assertion — cannot occur at runtime. |
| OpenAI down *and* confidence below threshold | Return the low-confidence local result as-is with `severity:"Unknown"`. An honest degraded answer beats an error. |
| Inference down *and* OpenAI down | Genuine 503 with a retry message. No label exists, so no diagnosis is possible. |
| Malformed / oversized image | Existing 400 validation, unchanged. |

The last row is a real hole with no workaround: a static knowledge base cannot be a final
fallback, because looking up an entry requires a class label, and producing a label requires a
classifier. "Zero customer-facing 500s" is achievable; "always a useful answer" is not.

## Verification

1. **`verify_dataset.py`** — hard gate. Zero group overlap across splits, or training does not start.
2. **Smoke train** — nano / 3 epochs / 5% completes and exports. Proves the pipeline before
   committing hours of GPU time.
3. **Real train + `evaluate.py`** — top-1, per-class recall, confusion matrix, confidence
   curve. Source of the threshold.
4. **Service test** — `/health` reports 30 classes; `/predict` on 10 known test images returns
   correct labels. Catches train/serve preprocessing drift.
5. **CPU latency benchmark** — 100 sequential predicts against the CPU-only container, report
   p50/p95. Confirms the 500ms budget on hardware that will actually serve.
6. **Resolver integration test** — three cases: high confidence → `source:"local"` with no
   OpenAI call; low confidence → `source:"openai"`; inference container stopped
   (`docker compose stop inference`) → `source:"openai_fallback"`.

**Explicitly not verified in Phase 1:** load testing, cost simulation, rate-limit behavior.
Those require Phases 3–4 and real traffic.

## Risks

### Cross-tenant cache sharing

`crop_analysis:${imageHash}` is global. Cached values contain no tenant identifiers — the
diagnosis derives purely from image content — so no tenant *data* crosses. The real exposure
is an **existence oracle**: someone holding a byte-identical image can infer that another
tenant already scanned it, via `processing_ms` or a `source` of `local`/`openai` on a
first-ever request. Low impact for crop photos, non-zero for a competitor probing an agrovet's
activity.

Phase 2 decision: keep global (maximum hit ratio), prefix per tenant (isolation, lower hit
ratio), or keep global while stripping timing hints from cached responses.

Note the underlying tension: deduplication value comes from *sharing* results across tenants.
Strict tenant isolation and a high cache-hit ratio are in direct conflict — a choice, not an
oversight.

### Agricultural advice quality

Knowledge table content is agronomy guidance farmers may act on, including pesticide choices.
Drafted by Claude, `reviewed: false` until an agronomist signs off. Dosages deliberately
deferred to local extension services.

### Threshold miscalibration

If the threshold is set too high, savings evaporate; too low, and farmers get confidently
wrong diagnoses with no fallback. Mitigated by deriving it from `evaluate.py`'s confidence
curve on a leak-free test split, and by making it an env var that can be tuned without a
redeploy.

## Known boundaries and deferred items

- **Inference service has no authentication.** It is safe only while it remains unpublished
  on the compose-internal network (no host port mapping). **Exposing it to any other network
  requires auth first.** Planned for a later phase.
- **`Scan.tenantId` and `Tenant.plan` do not exist.** Tenant-filtered scan queries and
  plan-based thresholds are Phase 2.
- **No cost tracking.** `cost_cents`, per-tenant attribution, and spending caps are Phase 4.
- **No rate limiting or circuit breakers.** Phase 3.
- **`generate_yaml.py` and `data.yaml` become unused** on the classification path. Left in
  place.
- **Datasets are untracked but not git-ignored.** `.gitignore` currently ignores only
  `/AImodel/venv`; the ~136k image directories should be added before any commit in `AImodel/`.

## Roadmap context

Phase 1 is the first of five independently shippable phases. Everything downstream depends on
a model existing.

| Phase | Scope |
|---|---|
| **1. Model + local-first path** *(this spec)* | Re-merge, train, inference service, knowledge table, resolver |
| 2. Tenancy on scans | `Scan.tenantId`, `Tenant.plan`, tenant-filtered queries, `X-Tenant-ID` |
| 3. Abuse & resilience | Rate limits, circuit breakers, timeouts, image validation/resize |
| 4. Cost & observability | `cost_cents`, per-tenant tracking, alerts, daily caps |
| 5. Scale | Partitioning, archival, async/batch, webhooks |

### Note on cost targets

The broader requirements set a $50/day cap for 10,000 scans/day at 5% OpenAI usage. That works
out to 500 calls/day — well under $1/day at gpt-4o-mini vision rates, and roughly $20–30/day
even at **100%** OpenAI on gpt-4o. The cap has large headroom, and current scan volume is
near zero. Phase 4's cost machinery should be built when volume justifies it, not before.
