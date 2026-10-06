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

It also removes duplicated data paths and redundant business logic found along the way.

### Success criteria

- Every route, page, service, package, and schema model left in the repo is reachable from one of
  the four surfaces above.
- Crop diagnosis runs in exactly one place (the backend), and the client never supplies a
  diagnosis result.
- User profile data has one source of truth (Prisma). Firestore is no longer read or written.
- `npm run build` passes for frontend and backend; the WhatsApp inbound test script and the
  backend integration test pass (updated for removed endpoints).

### Out of scope

- Building the Telegram channel or generalising the channel schema for it. `FarmerChannel`
  (`phone`, `waMessageId`) stays WhatsApp-shaped; the Telegram spec will generalise it with a
  concrete second channel in hand.
- Diagnosing WhatsApp images. The worker gains access to `diagnose()` but wiring it into the
  image intent belongs to the WhatsApp channel milestones.
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
on `User` and `Farm`. The repo has no tracked migrations directory, so the change is applied with
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
- `imageUrl` is not populated by this endpoint; image storage is not part of this cut.
- The `rateLimiter` middleware that guarded `/crops/analyze` moves onto `POST /scans`.
- Errors: `diagnose()` failures return 502 with a short message; the frontend shows a toast and
  lets the user retry. There is no fallback disease list.
- `Scan.tsx` loses the polling loop, the Firestore fallback, and the product recommendation
  panel.

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
  `POST /scans` contract, including a 403 for a farm the caller does not belong to.
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
- **Firestore-only profile fields.** If a displayed field exists only in Firestore, removing the
  read loses it. §6 requires checking each field before deleting the read.
