# Strip to Core — Design Spec

**Date:** 2026-10-06
**Status:** Approved for planning
**Related:** [WhatsApp Channel Design](./2026-08-10-whatsapp-channel-design.md),
[Local-First Crop Diagnosis](./2026-08-06-local-first-crop-diagnosis-design.md),
[Farm-Scoped Settings](./2026-08-10-farm-scoped-settings-design.md),
[Dashboard → WhatsApp Bridges](./2026-09-28-dashboard-whatsapp-bridges-design.md)

---

## 1. Intent

The product has grown sideways: a marketplace, a shop, a subscription page, IoT ingestion, task
lists, crop planners, a notifications centre, and a news feed, most of them stubs or half-wired.
Farmers are expected to arrive through messaging channels, not the website. This spec cuts the
codebase down to four things and nothing else:

1. **WhatsApp channel** — the existing inbound webhook, queue, worker, and intent router.
2. **Telegram channel** — not built here. This spec only avoids making it harder.
3. **AI inference** — one server-side `diagnose()` that every surface calls.
4. **Dashboard** — landing page, auth, dashboard home, scan, farms and settings.

**The product is the chatbot.** Farmers meet FarmAssist inside an app they already use
(WhatsApp, Telegram, and later USSD) and never have to learn a new system. Which channel carries
the conversation does not matter. The dashboard is a secondary surface for records and settings.
The channel-neutral conversation core and the low-confidence question flow are specified
separately in the Conversational Diagnosis Core spec. This spec only clears the ground for it.

**Supported crops:** tomato, potato, pepper, cashew and coffee. Cassava and maize are dropped,
per the agronomist review.

It also removes duplicated data paths and redundant business logic found along the way.

### Goal: a minimal MVP with the moat as its core

The MVP should have as few features as possible, and every one of them should feed one moat:
**a verified-data flywheel.** The loop is: a farmer sends a photo, the model diagnoses it, a
human confirms or corrects the diagnosis, the confirmed example becomes training data, and the
local model (see the Local-First spec) gets better and cheaper than any competitor's. A
competitor can copy the features. It cannot buy a growing set of verified, in-field photos of
Kenyan crops.

The moat is not a feature added on top. It is a rule that applies to every surface: **any
diagnosis must leave behind a training example** (the image, what the model said, which model
said it, and a slot for the verified label). A surface that diagnoses without capturing that
example is a bug. §4.1 defines the capture. Features are judged by whether they feed this loop:
scan, the WhatsApp and Telegram channels, and farmer confirmation feed it; a shop, task lists and
a news feed do not.

### Success criteria

- Every route, page, service, package, and schema model left in the repo is reachable from one of
  the four surfaces above.
- Crop diagnosis runs in exactly one place (the backend), and the client never supplies a
  diagnosis result.
- Every dashboard scan leaves behind a stored image, the model's raw output, the model name, and
  a nullable verified label. The farmer can confirm or reject the diagnosis in one tap.
- User profile data has one source of truth (Prisma). Firestore is no longer read or written.
- `npm run build` passes for frontend and backend; the WhatsApp inbound test script and the
  backend integration test pass (updated for removed endpoints).

### Out of scope

- Building the Telegram channel or generalising the channel schema for it. `FarmerChannel`
  (`phone`, `waMessageId`) stays WhatsApp-shaped; the Telegram spec will generalise it with a
  concrete second channel in hand.
- Diagnosing WhatsApp images. The worker gains access to `diagnose()` but wiring it into the
  image intent belongs to the WhatsApp channel milestones. When it is wired, it must use the same
  capture as §4.1, which is why capture lives in `scanService` and not in the controller.
- An agronomist review queue. `Scan.reviewStatus` already exists for it; the UI comes later.
  Farmer confirmation is the only label source in this MVP.
- Dataset export tooling. The rows and image files are the dataset; an export script gets
  written when the first training run needs one.
- Local model training and serving. `AImodel/` and the local-first spec are untouched.
- Landing page redesign. It stays as is.

## 2. What stays

| Area | Kept |
|---|---|
| Frontend public | `Index` landing page and its components, animations and images; `Login`, `SignUp`, `ForgotPassword`; `NotFound` |
| Frontend app | `Dashboard` (simplified, §5), `Scan` (simplified, §4), `Settings` (deduplicated, §6), farm switching via `FarmContext`, `DashboardLayout` |
| Frontend libs | `api/client`, `firebase` (Auth only), `i18n`, `image_upload_util`, `utils`, `weather`, `useAuth`, `use-toast`, `use-mobile` |
| Backend | `app.ts`, `server.ts`, `config/env`, `auth.middleware`, `rateLimiter.middleware`, `channels/whatsapp/*`, routes/controllers for `dashboard`, `farm`, `scan`, `user`; services `farmer`, `channelEvent`, `scan`, `farmNote`, `farmAccess`; `farm.validator` |
| Packages | `packages/ai`, `packages/database`, `packages/firebase-admin` (Auth only), `packages/shared-types`, `infrastructure/redis` |
| Schema | `User`, `Tenant`, `TenantUser`, `Farm`, `Scan`, `FarmNote`, `FarmerChannel`, `ChannelEvent`, enums `TenantType`, `Role`, `ChannelDirection` |
| Other | `AImodel/`, all existing specs, Docker setup, Firebase Hosting config |

`FarmNote` survives without a UI because the WhatsApp worker writes voice notes into it. Its REST
route and page go; the model and service stay.

## 3. What goes

### Frontend

- Pages and features: `Notifications`, `Planning` (`/crop-planner`), `TodoList` (`/planning`),
  `FarmLogs`, `Trees`, `Agrovet`, `Shop`, `Subscription`, and `features/farms/Farms.tsx` if farm
  creation already lives in Settings (verify during implementation; keep it if it does not).
- Libs and services: `disease_fallback.ts`, `products.ts`, `openai_vision_api.ts`,
  `notifications.service.ts`, `iot.service.ts`.
- Firestore usage in `lib/firebase.ts` (`db` export and `firebase/firestore` import).
- Sidebar entries and links in `DashboardLayout` pointing at removed routes; the notifications
  bell and unread count.
- shadcn `components/ui/*` files with zero imports after the cut, and npm dependencies with zero
  imports after the cut.

### Backend

- Routes, controllers: `agrovet`, `crop`, `disease`, `farmnote`, `iot`, `notification`,
  `product`, `task`.
- `services/notification.service.ts`.
- Mounts for all of the above in `app.ts`.

### Packages and root

- `infrastructure/queue` (the BullMQ `ai-queue`). The WhatsApp inbound queue in
  `channels/whatsapp/inbound.queue.ts` is unaffected.
- Firestore exports (`dbAdmin`) from `packages/firebase-admin`; `authAdmin` stays.
- `firestore.rules`, `firestore.indexes.json`, the `firestore` block in `firebase.json`.
- `scripts/seed-diseases.ts` (seeds the Firestore disease list).
- `tests/test-prisma.ts` (ad hoc connectivity check, superseded by the integration test).

### Schema

Drop `Notification`, `Task`, `Crop`, `Agrovet`, `Product`, `NewsItem` and their relation fields
on `User` and `Farm`. Add `Scan.analysis`, `Scan.model`, `Scan.verifiedLabel` and
`Scan.verifiedBy` (§4.1), all nullable so that existing rows remain valid. The repo has no
tracked migrations directory, so the change is applied with
`prisma db push`. **This deletes those tables and their rows.** Take a `pg_dump` of the dev
database before pushing.

## 4. AI inference: one synchronous `diagnose()`

### Today

The browser posts the image to `POST /crops/analyze`, which enqueues a BullMQ job on `ai-queue`.
The browser polls `GET /crops/analyze/:jobId`, receives the result, then posts the result itself
to `POST /scans`. The server stores whatever diagnosis the client sends. If analysis fails, the
browser falls back to a static disease list read from Firestore via `/diseases`.

Three problems: two round-trip protocols for a ~2s call, a second queue for work that is already
queued on the WhatsApp side, and a scan record whose diagnosis is client-supplied and therefore
untrusted.

### After

```
Dashboard:  Scan.tsx ──POST /scans {imageBase64, farmId}──▶ scan.controller
                                                              │
                                                              ├─ userCanAccessFarm
                                                              ├─ diagnose(imageBase64)   (packages/ai)
                                                              └─ scanService.createScan
                                                              ◀── 201 {scan, analysis}

WhatsApp:   inbound.worker ──(future milestone)──▶ diagnose(image) ──▶ scanService.createScanForMessage
```

- `packages/ai` exports `diagnose(imageBase64)`: the existing OpenAI vision call with its Redis
  cache and 10MB size check, renamed from `analyzeCropImage`. The unused `farmId` parameter is
  removed.
- `POST /scans` accepts `{ imageBase64, farmId? }`. It checks farm access, calls `diagnose()`,
  stores the scan with the server's result, and returns the scan plus the full analysis
  (symptoms, causes, treatment, prevention) for display. It no longer accepts `diseaseName`,
  `confidence` or `treatment` from the client.
- The scan is stored with the full training example defined in §4.1.
- The `rateLimiter` middleware that guarded `/crops/analyze` moves onto `POST /scans`.
- The `diagnose()` prompt is restricted to the five supported crops. A photo of any other crop
  returns `diseaseName: "Unsupported crop"` with the identified `cropType`, and no treatment is
  given. These scans are still captured (§4.1) because they show which crop to support next.
- Errors: `diagnose()` failures return 502 with a short message; the frontend shows a toast and
  lets the user retry. There is no fallback disease list.
- `Scan.tsx` loses the polling loop, the Firestore fallback, and the product recommendation
  panel.

### 4.1 Training-example capture (the moat)

`scanService.createScan` is the only place a diagnosis is written, so it is the only place that
captures training data. Every caller (the dashboard now, WhatsApp and Telegram later) gets the
capture without doing anything extra.

- **Image.** The image bytes are written to `apps/backend/data/scans/<sha256>.jpg`, with the
  sha256 taken over the bytes. `packages/ai` already hashes images for its cache, so the hash is
  computed once and reused. Duplicate uploads land on the same file. `Scan.imageUrl` stores the
  key (`scans/<sha256>.jpg`), not a public URL. These images are farm data and the core asset,
  so they are **not** served from `/api/v1/public` like avatars are. Docker Compose gets a volume
  for `apps/backend/data`, and the directory is gitignored.
  `// ponytail: local disk; move to object storage when the backend runs on more than one host.`
- **Model output.** A new `Scan.analysis Json?` column stores the raw `diagnose()` result
  (crop type, severity, symptoms, causes, treatment, prevention) exactly as the model returned
  it. `diseaseName`, `confidence` and `treatment` stay as columns for querying and display.
- **Model identity.** A new `Scan.model String?` column, for example
  `openai:<AI_MODEL>@<prompt-hash>` today and `local:yolo11s-cls@<run>` later. Labels are only useful
  for training if you know which model produced the prediction being labelled. The existing
  `workerVersion` column keeps its WhatsApp-worker meaning.
- **Verified label.** A new `Scan.verifiedLabel String?` column plus
  `Scan.verifiedBy String?`. `verifiedBy` holds `farmer` now, and later `agronomist:<userId>`.
  A farmer confirmation is a weaker signal than an agronomist's, and keeping the source lets
  training weight or filter them.

**Farmer confirmation.** Under the result, the dashboard shows "Was this right?" with two
buttons. `PATCH /scans/:id/verify { correct: boolean, label?: string }` sets
`verifiedLabel` to the model's `diseaseName` when the answer is yes, and to `label` (or
`"rejected"`) when it is no. It also sets `verifiedBy` to `farmer`. Only the scan's owner can
call it. A scan that already has a non-farmer verification is not overwritten.

**Consent.** Kenya's Data Protection Act 2019 requires telling farmers that their photos are used
to improve the model. The SignUp page gets one sentence saying so next to the existing submit
button. The WhatsApp welcome message adds the same sentence when that milestone ships.

## 5. Dashboard home

`dashboard.controller` currently returns user, farms, notifications, unread count, scans, scan
count, news, crop count and task count. After the cut it returns **user, farms, recent scans and
scan count**. `Dashboard.tsx` keeps weather (client-side, `lib/weather.ts`), the farm summary and
recent scans; cards for alerts, news, crops and tasks are removed. `shared-types` `DashboardData`
is updated to match.

## 6. Removing duplication

- **Profile source of truth.** `Settings.tsx` and `DashboardLayout.tsx` read and write a
  Firestore `users/{uid}` document in addition to the Prisma `User` that `PATCH /users/profile`
  updates. Both now read the profile from the API (`GET /dashboard` already returns the user, or
  a `GET /users/me` if the layout needs it before the dashboard loads) and write only through
  `PATCH /users/profile`. Any field that exists only in Firestore and is still displayed is added
  to the Prisma `User`; fields with no remaining consumer are dropped.
- **Settings UI.** `Settings.tsx` renders the settings interface twice (a legacy single-scroll
  page inside the `profile` section and the per-section panes). The legacy copy is deleted, as
  are the subscription upsell blocks and notification preference toggles whose features no longer
  exist. This overlaps the Farm-Scoped Settings spec, which can proceed on the deduplicated file.
- **Repeated dashboard fetch.** `DashboardLayout` calls `getDashboardData()` from two separate
  effects. Fetch once and share the result.
- Any further duplication found while deleting (duplicate helpers, dead branches for removed
  features) is removed in the same change, without changing behaviour of kept features.

## 7. Verification

- Frontend and backend type-check and build.
- `scripts/whatsapp-inbound-test.ts` passes unchanged.
- `scripts/integration-test.ts` is updated to drop removed endpoints and to exercise the new
  `POST /scans` contract, including a 403 for a farm the caller does not belong to. It also
  checks the capture: after a scan, the image file exists at the stored key, and `analysis` and
  `model` are set. `PATCH /scans/:id/verify` sets the label for the owner and returns 403 or 404
  for anyone else.
- Manual: sign up, log in, see the dashboard home, run a scan and see the result appear in recent
  scans, change profile settings, create and switch farms, reload and confirm settings persisted.
- `grep` for `firestore`, `dbAdmin`, `aiQueue`, `/crops`, `/notifications`, `/products`,
  `/agrovets`, `/tasks`, `/farm-notes`, `/iot`, `/diseases` across `apps/` and `packages/` returns
  nothing.

## 8. Risks

- **Data loss.** `prisma db push` drops six tables. Mitigated by the pre-push dump; this is a dev
  database with no production users.
- **Hidden consumers.** A kept file may import something on the cut list. Building after each
  deletion group catches this; the plan orders deletions leaves-first.
- **Distillation ceiling.** Until farmers or agronomists verify scans, the stored labels are
  OpenAI's predictions, so training on them only teaches the local model to copy OpenAI.
  Verified labels are what turn the dataset into a moat. The confirmation tap is in the MVP for
  that reason, and its usage rate is the number to watch.
- **Image volume loss.** If the data volume is lost, the moat is lost with it. Back up
  `apps/backend/data` alongside the Postgres dump.
- **Firestore-only profile fields.** If a displayed field exists only in Firestore, removing the
  read loses it. §6 requires checking each field before deleting the read.
