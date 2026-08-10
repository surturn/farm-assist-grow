# WhatsApp Channel — Design Spec

**Date:** 2026-08-10
**Status:** Approved for planning
**Scope:** v1 (ship to real farmers for market validation), with v1.1 boundaries marked

---

## 1. Problem

Agricultural apps in Kenya struggle with adoption for reasons unrelated to hardware. Smallholders
own smartphones but often do not know farming apps exist, cannot navigate dense text interfaces,
cannot justify the data cost of continuous app usage, and distrust digital advice from developers
with no visible connection to their farm. They already communicate through WhatsApp, radio, peer
groups, and physical extension officers.

The current FarmAssist dashboard assumes the opposite of all of this. It is desktop-first,
text-dense, English-only, and every capability sits behind a login the farmer must remember to
open. Notifications are in-app rows — nothing ever leaves the application.

## 2. Approach

**WhatsApp owns the moment. The app owns the record.**

A farmer never opens a dashboard to *react*; they open it to *review*. So immediate action —
diagnosing a sick crop, logging what happened today, being warned before spraying — happens in
WhatsApp, where the farmer already is and where data is commonly covered by cheap social bundles.
History, overview, and settings stay in the app, whose real audience becomes extension officers,
co-op leads, and the farmer reviewing later.

Onboarding is a `wa.me` link or a printed QR code on an agrovet counter. No app store, no download,
no "farmers don't know it exists".

### Non-goals for v1

- Redesigning the dashboard for low digital literacy. The fix for text-averse users is the WhatsApp
  channel, not a friendlier dashboard. Revisit as a separate spec after observing real usage.
- LLM free-text Q&A.
- Speech-to-text (see §6.2 — v1 does not need it).
- SMS fallback. The seam is built; no implementation.
- Payments or marketplace flows over WhatsApp.

## 3. Platform constraints that shape the design

These are not preferences. They are properties of the WhatsApp Business Platform that the
architecture must encode.

**The 24-hour window.** Free-form messages may only be sent within 24 hours of the farmer's last
inbound message. Outside it, only pre-approved **template messages** may be sent, with Meta
reviewing each template's exact wording. All push alerts are therefore templates with variable
slots, not free-form text.

**Quality rating.** Ignored or blocked messages cause Meta to throttle and then ban the business
number. Frequency caps and one-word opt-out are survival features, not polish.

**Per-message pricing by category.** Meta moved template messaging to per-message pricing during
2025, priced by category, with utility messages inside an open service window treated differently
from those outside it. **Current Kenya rates for utility and service categories must be verified
before finalising alert frequency and the cost cap defaults in §7.1.** This spec deliberately does
not hardcode figures.

**Media URL expiry.** Media URLs returned by Meta expire quickly. Media must be downloaded and
persisted by the worker before any other processing.

## 4. Architecture

Approach: a channel module inside the existing backend, built with the seam for extraction
pre-cut.

```
WhatsApp (Meta Cloud API)
        │ webhook POST
        ▼
apps/backend/src/channels/whatsapp/
   webhook.route.ts     verify signature → enqueue → 200. Nothing else.
   inbound.worker.ts    BullMQ consumer; all real processing
   intent.router.ts     image | text | voice | command (SIMAMA, LUGHA…)
   session.store.ts     Redis session, 12h TTL, PIN gate
   templates/           approved template catalog + SW/EN renderer
   outbound.queue.ts    BullMQ send queue: retry, rate limit, dedupe, cost cap
   sender.ts            implements MessagingChannel
   media.ts             download from Meta → Firebase Storage
        │ reaches the domain ONLY through ↓
apps/backend/src/services/
   scan.service.ts   farmNote.service.ts
   notification.service.ts   farmer.service.ts   channelEvent.service.ts
```

The webhook handler must acknowledge within seconds or Meta retries and duplicates messages. It
verifies the signature, enqueues, and returns. Existing BullMQ + ioredis dependencies cover this
with no new infrastructure.

`MessagingChannel` is a one-method port — `send(to, message)` — implemented by `WhatsAppChannel`
today and `SmsChannel` later. This is the entire SMS investment in v1.

### 4.1 Required refactor: extract a service layer

Controllers currently issue Prisma calls inline (`scan.controller.ts` writes to the database
directly inside the Express handler). WhatsApp becomes a second entry point creating scans, farm
notes, and notifications. Without extraction that logic is duplicated across two callers and
drifts.

Scope is limited to the three domains WhatsApp touches, plus the two new ones it introduces. This
is not a general refactor: only what two callers force.

### 4.2 Documented split-out path (not built in v1)

The module reaches the domain only through `services/`, and every outbound message already crosses
a queue boundary. Extraction to `apps/whatsapp` therefore means pointing a second worker at the
same Redis and giving it the Prisma package — a deploy change, not a rewrite.

**Split when any of these becomes true:**

- Webhook or worker load measurably degrades main API latency.
- The channel needs an independent deploy cadence from the API.
- Meta rate-limit handling requires dedicated scaling.

**Invariants that must hold to keep the path cheap:** no WhatsApp module file imports Prisma
directly; no controller imports anything from `channels/whatsapp/`; all outbound sends go through
the queue.

## 5. Identity, sessions, and linking

### 5.1 Model

A new `FarmerChannel` keyed on E.164 phone number, holding: `userId` (null until linked),
`language`, `pinHash`, a one-time `linkToken` with expiry, `optedOut`, and `lastInboundAt`.

`lastInboundAt` is load-bearing: **the sender checks it and refuses to send free-form messages
outside the 24-hour window**. The platform rule becomes a code invariant rather than something a
developer must remember.

`User.preferredLanguage` already exists and defaults to `"en"`; `FarmerChannel.language` holds the
preference before an account exists and syncs on link.

### 5.2 Linking flow

1. An unknown number messages the business number.
2. The reply carries a one-time token link — `farmassist.app/join/<token>`.
3. The farmer signs up on the website normally, with full profile and farm setup.
4. The signup page carries the token, so on completion the backend binds `phone → userId`
   automatically, and any provisional scans are backfilled to the new user.

The farmer never types credentials back into WhatsApp. Arriving from that number is the proof of
possession. This is one tap instead of two typed fields, and no secret ever enters chat history.

**Rejected alternative — typing email and password into WhatsApp.** Three reasons. The Firebase
Admin SDK has no server-side password verification API, so the backend would have to POST raw
credentials to Firebase's REST sign-in endpoint, handling plaintext passwords it was architected
never to touch. The password would persist in the farmer's chat history, in webhook logs, and in
Meta's infrastructure — on phones that are commonly shared within a household. And requiring an
email address and case-sensitive password to be typed twice a day reintroduces precisely the
literacy barrier this channel exists to remove.

### 5.3 Sessions and the PIN gate

Redis holds `wa:session:<phone>` with a **12-hour TTL**. The PIN is four digits, set at signup,
hashed, and deliberately **separate from the account password** — a numeric keypad entry, no case
sensitivity, and a leak in chat history does not compromise the dashboard account.

The gate is **context-aware**:

- **Routine actions** (crop scan, farm log) proceed on a valid session. Once the 12-hour TTL
  expires, the next interaction prompts for the PIN before continuing to the intended action.
- **Sensitive actions** (settings changes, financial or payout data, viewing full history) require
  immediate PIN verification regardless of session age.

Shared household phones are the reason this exists.

**Open consideration.** Under this policy a farmer whose session has just expired hits a PIN prompt
before an urgent scan. If real usage shows drop-off at that prompt, the mitigation is to let the
first scan of a session through and prompt for the PIN immediately *after* delivering the result.
Not adopted in v1 — flagged for review once §9.2 event data exists to measure it.

### 5.4 First-scan policy

The first crop scan from an unlinked number is delivered in full, free and unauthenticated, and
stored provisionally against the `FarmerChannel`. The invite link is appended after the result.
The second scan requires registration.

Value first, registration second: gating the very first interaction would put a signup link in
front of a farmer whose maize is dying, at the point of highest drop-off and highest learning
value.

## 6. Flows

### 6.1 Photo → diagnosis

Download media from Meta immediately (before any AI work) → `sharp` resize → `packages/ai` → reply
with a short, image-led message plus a TTS voice note in the farmer's language.

If media download fails, the session records it and an automated "please send the photo again"
prompt is returned **without invoking the AI layer**.

### 6.2 Farm log by reply

The farmer sends text or a voice note. **Voice notes are stored as the log entry itself and played
back in the dashboard.** No transcription is performed.

This is a deliberate design choice, not a shortcut: it is fully oral, costs nothing in inference,
carries zero transcription-accuracy risk on code-switched Swahili, and preserves the record in the
farmer's own voice. Speech-to-text becomes a later enhancement for *search*, never a prerequisite
for *capture*.

`FarmNote.farmId` becomes nullable. When the farmer owns exactly one farm it is resolved
automatically; otherwise the farmer is asked once and the answer is remembered for the session.

### 6.3 Push alerts

A repeatable BullMQ job evaluates farms against weather and crop-stage rules, renders an approved
template, and enqueues it.

**Four templates for v1** — kept small because Meta reviews each:

| Template | Category | Deferrable |
|---|---|---|
| `weather_spray_warning` | Utility | **No** |
| `crop_stage_action` | Utility | Yes |
| `scan_followup` (7 days after a diagnosis) | Utility | Yes |
| `link_reminder` (unsaved provisional scans) | Utility | Yes |

Controls: a hard per-farmer weekly frequency cap, quiet hours, a dedupe key so nothing fires twice,
and `SIMAMA` / `STOP` for instant opt-out.

## 7. Cost and platform governance

### 7.1 Category isolation and cost cap

Every template in the catalog carries its Meta category as a typed field. The outbound queue
rejects any send whose declared category does not match the catalog entry, making cross-category
drift a build-or-runtime error rather than a billing surprise.

A **cost circuit breaker** tracks outbound volume per farmer per billing cycle in Redis. On breach,
alerts to that number pause and the farmer is flagged in the dashboard for review. Defaults are set
only after the rate verification in §3.

### 7.2 Window optimisation, with the critical exception

Deferrable alerts queue and ride free inside an already-open farmer-initiated service window, with
a **maximum defer horizon** after which they either send paid or expire.

**Non-deferrable alerts always send immediately as paid utility templates.** A spray warning that
waits for the farmer to open a window is worthless — the rain has already come. Cost optimisation
must never be allowed to silently gut the product's most valuable message.

### 7.3 Media handling

**Audio: store the Opus as received.** WhatsApp voice notes arrive as OGG/Opus, already mono and
low-bitrate. Opus is more efficient than MP3 or AAC at voice bitrates, so transcoding would spend
CPU to *increase* storage while adding generation loss. An AAC fallback is generated **lazily and
cached**, only for clients that cannot play Opus. Target-browser support should be confirmed during
implementation.

**Images: resize in the worker, immediately.** The full-resolution original goes to a hot prefix
under a **7-day lifecycle policy**; only the compressed diagnostic thumbnail is retained
permanently.

**Storage: Firebase Storage**, since `firebase-admin` and credentials are already provisioned and
nothing new needs standing up. All media access is confined to `channels/whatsapp/media.ts` so the
blast radius of a later move to R2 is one file.

## 8. Trust and failure handling

**Low confidence is surfaced honestly.** Below the confidence threshold the system says so —
"sipati uhakika" — and routes the farmer onward rather than guessing. Skepticism of digital advice
is one of the core adoption barriers; a single confidently wrong diagnosis costs a village. Honest
uncertainty is a feature.

In v1 that routing is **county-level**: agrovets matched on region. See §10 for the v1.1 upgrade.

Other failure paths:

- Invalid webhook signature → reject, log, no enqueue.
- Media download failure → in-language resend prompt, AI not invoked.
- Outbound send failure → BullMQ retry with backoff; after exhaustion, mark failed and surface in
  the dashboard alert log.
- Free-form send attempted outside the 24-hour window → rejected by the sender (§5.1).

## 9. Data integrity and telemetry

### 9.1 Provenance

`Scan` and `FarmNote` records originating from WhatsApp carry unambiguous metadata: the WhatsApp
message ID, the Meta media ID, and the worker version.

**The message ID carries a unique index and doubles as the idempotency key** for Meta's duplicate
webhook retries — reprocessing becomes a no-op. One field solves both provenance and deduplication.

### 9.2 ChannelEvent

An **append-only `ChannelEvent` table**, written by the worker on every inbound message, outbound
send, and delivery-status callback.

**Rejected alternative — syncing metrics from Redis on session expiry.** Redis keyspace expiry
notifications are fire-and-forget: undelivered when no subscriber is connected, dropped on restart
or failover, and absent entirely when `maxmemory` eviction removes the key. Retention metrics
presented to investors cannot rest on a lossy channel. `ChannelEvent` also serves as the audit log,
so one table satisfies both provenance and analytics, and Redis reverts to being purely a session
cache.

Cohort metrics — daily active farmers, interactions per window, inbound-to-push conversion — are
plain SQL over this table. v1 records the events; v1.1 builds the dashboards.

### 9.3 Connectivity telemetry

Delivery-status callbacks are recorded with their failure reasons, building an evidence base for
where and when rural connectivity drops. This is what makes a later SMS fallback a data-driven
decision rather than a guess.

## 10. Schema changes

| Model | Change | Needed by |
|---|---|---|
| `FarmerChannel` | New. Phone-keyed identity, language, PIN, link token, opt-out, `lastInboundAt` | v1 |
| `ChannelEvent` | New. Append-only event log | v1 |
| `Scan` | `userId` → nullable; add `channelId`, `waMessageId` (unique), `mediaId`, `workerVersion`, `reviewStatus` | v1 |
| `FarmNote` | `farmId` → nullable; add `channelId`, `waMessageId` (unique), `audioUrl`, `workerVersion` | v1 |
| `Agrovet` | Add `latitude`, `longitude` | schema v1, used v1.1 |

`Scan.reviewStatus` and the `Agrovet` coordinates ship in the v1 schema **specifically so that the
v1.1 features below require no migration.**

## 11. Dashboard changes

The app is the record room, so changes are provenance and control — not a redesign:

- Channel badges on WhatsApp-originated scans and notes.
- Voice-note playback in farm logs.
- Settings → WhatsApp: linked number, language, PIN reset, alert frequency, quiet hours, opt-out.
- Alert delivery log — required to defend the quality rating and debug failures.
- Invite panel producing a `wa.me` link and a printable QR poster for agrovet and co-op counters.
  This is the distribution mechanism.

## 12. Deferred to v1.1

Deferred because each needs data that does not exist yet. Building them now means guessing at
shapes that real usage will contradict — while the v1 schema (§10) ensures they drop in without
migration.

- **Human-in-the-loop triage.** Low-confidence scans queue into a dashboard review view; an
  extension officer resolves it and a callback message reaches the farmer. Note that the expert
  reply will frequently fall outside the 24-hour window, so it requires an `expert_review_ready`
  template. Deferred pending observed low-confidence volume, which determines whether this is a
  queue or a trickle. This also produces a proprietary verified dataset for model fine-tuning.
- **Geospatial agrovet mapping.** Three nearest verified agrovets on low confidence. Blocked on
  coordinates *and* seeded real agrovet data; `Agrovet.location` is currently a plain string.
- **Cohort analytics dashboards.** Blocked on having cohorts.

## 13. Testing

- Intent router: unit tests against real captured Meta webhook payloads.
- **Sender invariant:** a free-form send outside the 24-hour window must throw.
- **Category invariant:** a send whose category mismatches the catalog must be rejected.
- Idempotency: replaying an identical webhook payload creates no second record.
- Session and PIN: expiry behaviour, wrong-PIN lockout, that an expired session prompts once and
  then resumes the intended action, and that sensitive actions prompt on a fresh session.
- Template renderer: every variable populated, in both Swahili and English.
- Cost circuit breaker: alerts pause on cap breach.
- Manual E2E over ngrok with a real test number for the photo flow.

## 14. Open items for implementation

1. Verify current Meta per-message rates for Kenya (utility and service categories) before setting
   frequency caps and cost-cap defaults.
2. Confirm Opus playback support across the dashboard's actual target browsers to size the lazy
   AAC fallback work.
3. Submit the four v1 templates for Meta approval early — review latency is on the critical path.
