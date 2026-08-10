# WhatsApp Channel — Implementation To-Do

**Companion to:** [WhatsApp Channel Design Spec](./2026-08-10-whatsapp-channel-design.md)
**Related:** [Phase 1 Local-First Crop Diagnosis](./2026-08-06-local-first-crop-diagnosis-design.md)

Ordered by dependency. Each milestone is independently verifiable; do not start one before its
predecessor passes its check.

---

## 0. Pre-flight — start today, these have external latency

- [ ] **Create the Meta WhatsApp Business account** and get a test number issued. Business
      verification can take days; nothing else is testable end-to-end until it exists.
- [ ] **Submit the four v1 templates for review** — `weather_spray_warning`, `crop_stage_action`,
      `scan_followup`, `link_reminder`, each in Swahili and English. **This is the critical path.**
      Meta review latency is outside your control and gates all of Milestone 5.
- [ ] **Verify current Meta per-message rates for Kenya** (utility and service categories). These
      set the frequency caps and cost-cap defaults in Milestone 5. Do not guess.
- [ ] **Confirm Opus playback** across the dashboard's target browsers, to size the lazy AAC
      fallback in Milestone 4.
- [ ] **Clean the local working copy** (see §Housekeeping below) — 21 GB of datasets are sitting
      untracked in `AImodel/`.

## 1. Foundations — schema and service layer

No WhatsApp code yet. This is the ground everything else stands on.

- [ ] Prisma migration: add `FarmerChannel` (phone E.164 unique, `userId?`, `language`, `pinHash`,
      `linkToken` unique + expiry, `optedOut`, `lastInboundAt`).
- [ ] Prisma migration: add `ChannelEvent` (append-only; direction, type, payload ref, timestamps).
- [ ] Prisma migration: `Scan.userId` → nullable; add `channelId`, `waMessageId` (**unique**),
      `mediaId`, `workerVersion`, `reviewStatus`.
- [ ] Prisma migration: `FarmNote.farmId` → nullable; add `channelId`, `waMessageId` (**unique**),
      `audioUrl`, `workerVersion`.
- [ ] Prisma migration: `Agrovet` gains `latitude`, `longitude` (unused until v1.1 — ships now so
      v1.1 needs no migration).
- [ ] Extract `scan.service.ts` from `scan.controller.ts`; controller becomes a thin HTTP wrapper.
- [ ] Extract `farmNote.service.ts` and `notification.service.ts` the same way.
- [ ] Add `farmer.service.ts` (phone ↔ user linking) and `channelEvent.service.ts`.

**Check:** existing REST endpoints behave identically; no controller contains a Prisma call.

## 2. Inbound pipeline

- [ ] `webhook.route.ts` — Meta verification handshake (GET) and message receipt (POST).
- [ ] **HMAC-SHA256 signature verification** against the app secret using a **timing-safe compare**,
      before anything is enqueued. Reject invalid signatures with no queue write.
- [ ] Enqueue to BullMQ and return 200 immediately. No processing in the handler.
- [ ] `inbound.worker.ts` consuming the queue.
- [ ] Idempotency: unique `waMessageId` makes a replayed webhook a no-op.
- [ ] `intent.router.ts` — image / text / voice / command (`SIMAMA`, `STOP`, `LUGHA`).
- [ ] Write a `ChannelEvent` row for every inbound message.

**Check:** replaying a captured webhook payload twice creates exactly one record; an invalid
signature never reaches the queue.

## 3. Identity, linking and the PIN gate

- [ ] `session.store.ts` — Redis `wa:session:<phone>`, 12h TTL.
- [ ] Unknown number → generate one-time `linkToken`, reply with the join link.
- [ ] Website `/join/<token>` route: carries the token through signup, binds `phone → userId` on
      completion, backfills provisional scans.
- [ ] 4-digit PIN set during signup, hashed, stored on `FarmerChannel`. Separate from the account
      password.
- [ ] Context-aware gate: expired session prompts once then resumes the intended action; sensitive
      actions (settings, financial, full history) prompt regardless of session age.
- [ ] Wrong-PIN lockout after N attempts.

**Check:** a full cold journey — first message → link → signup → return → action — with nothing
typed into chat but the PIN.

## 4. Photo → diagnosis

- [ ] `media.ts` — download from Meta **immediately** on receipt (URLs expire fast), persist to
      Firebase Storage. All media access confined to this file.
- [ ] Image lifecycle: full-resolution original to a hot prefix with a **7-day** rule; compressed
      diagnostic thumbnail retained permanently.
- [ ] Wire `packages/ai` → reply with a short image-led message.
- [ ] Swahili/English TTS voice-note reply, cached by rendered-message hash so repeats cost nothing.
- [ ] Audio: **store Opus as received.** Lazy AAC fallback, cached, only for clients that need it.
- [ ] Low-confidence path: say `sipati uhakika`, route to county-matched agrovets, never guess.
- [ ] Media download failure → in-language resend prompt, **without** invoking the AI layer.
- [ ] First-scan policy: unlinked first scan delivered free and stored provisionally; second scan
      requires registration.

**Check:** a real photo from a real handset returns a correct diagnosis with a playable voice note.

## 5. Outbound alerts

Blocked on template approval from §0.

- [ ] `sender.ts` implementing `MessagingChannel`.
- [ ] **24h-window invariant:** the sender reads `lastInboundAt` and refuses free-form sends outside
      the window. Enforced in code, not by convention.
- [ ] **Category invariant:** every template carries its Meta category; a mismatched send is
      rejected.
- [ ] `outbound.queue.ts` — retry with backoff, dedupe key, per-farmer weekly frequency cap, quiet
      hours.
- [ ] **Cost circuit breaker:** per-farmer per-cycle counters in Redis; on breach, pause alerts and
      flag in the dashboard.
- [ ] Scheduler with `deferrable` flag — deferrable alerts ride an open service window with a max
      defer horizon; `weather_spray_warning` **always sends immediately**.
- [ ] `SIMAMA` / `STOP` opt-out, honoured before any send.
- [ ] Record delivery-status callbacks (sent/delivered/read/failed) as `ChannelEvent` rows.

**Check:** a free-form send outside the window throws; a capped farmer receives nothing; a spray
warning is never deferred.

## 6. Farm log by reply

- [ ] Text reply → `FarmNote`.
- [ ] Voice note → stored as the log entry itself, `audioUrl` set, **no transcription**.
- [ ] Farm resolution: auto-select when the farmer owns exactly one farm; otherwise ask once and
      remember for the session.

**Check:** a voice note sent from WhatsApp plays back in the dashboard.

## 7. Dashboard surfaces

- [ ] Channel badge on WhatsApp-originated scans and notes.
- [ ] Voice-note playback in farm logs.
- [ ] Settings → WhatsApp: linked number, language, PIN reset, alert frequency, quiet hours,
      opt-out.
- [ ] Alert delivery log — needed to defend the quality rating and debug failures.
- [ ] Invite panel: `wa.me` link plus a printable QR poster for agrovet and co-op counters.

## 8. Verification before farmers touch it

- [ ] Intent router unit tests against real captured Meta payloads.
- [ ] Sender invariant tests (window, category).
- [ ] Idempotency test (duplicate webhook).
- [ ] Session/PIN tests (expiry, lockout, sensitive-action gating).
- [ ] Template renderer completeness, both languages.
- [ ] Cost circuit breaker test.
- [ ] Manual E2E over ngrok with a real handset.

## Deferred to v1.1 — do not build now

HITL triage queue and expert callback (needs an `expert_review_ready` template), geospatial agrovet
matching (needs coordinates **and** seeded agrovet data), cohort analytics dashboards. The §1 schema
means none of these require a migration later.

---

## Sequencing note: this work vs. the local-first model

The [Phase 1 spec](./2026-08-06-local-first-crop-diagnosis-design.md) replaces the OpenAI call in
`packages/ai/index.ts` with a local classifier, keeping the return shape and adding `source`,
`confidence` and `processing_ms`.

These two efforts touch the same seam but do not conflict:

- WhatsApp consumes `analyzeCropImage()` through `scan.service.ts` and reads `confidence` to decide
  the `sipati uhakika` path. That works identically whether the answer came from OpenAI or the local
  model.
- **Build WhatsApp first.** It needs no trained model and puts the product in front of real farmers
  now; the local model is a cost optimisation whose value scales with volume you do not yet have.
- Phase 1's confidence threshold and this spec's low-confidence hand-off are the *same knob*. Pick
  the threshold once, from `evaluate.py`'s confidence curve, and let both read it.
- Phase 1's dataset group-leakage problem is a hard blocker on training but has **no bearing** on
  the WhatsApp channel. It does not gate anything here.

## Housekeeping — run in your own checkout

The cleanup branch fixes `.gitignore`, but the untracked junk still sits in your working copy and
must be removed by you (this session was sandboxed to a worktree and could not touch it).

After merging `whatsapp-channel-design`, from the repo root:

```bash
# Verify what the new .gitignore now excludes — expect the dataset trees and Microsoft/
git status --ignored --short

# Junk with no source value — safe to delete
rm -rf Microsoft/
rm -f AImodel/structure.txt

# 21 GB of ML datasets: keep on disk for training, now correctly git-ignored.
# Do NOT delete unless you have them archived elsewhere.
```

`apps/backend/public/avatars/` holds runtime user uploads and is now ignored — leave the files in
place, they are live data.
