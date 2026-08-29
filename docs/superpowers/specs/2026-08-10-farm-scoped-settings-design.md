# Farm-Scoped Settings — Design

**Date:** 2026-08-10
**Status:** Approved for planning

## Problem

Farms sit in different geographic areas and therefore have different weather, needs, and
disease pressure. Today the app cannot express this: `User.region` holds a single region for
the whole account, and `dashboard.controller.ts:15` reads it directly. A farmer with land in
Rift Valley and Coast sees one region's weather for both.

A second, compounding problem sits in the UI. `Settings.tsx` (940 lines) contains the entire
settings interface twice — once as a legacy single-scroll page nested inside the
`activeSection === "profile"` block, and once as the discrete panes the sidebar implies. The
Region control therefore exists in two places, both bound to the same `formData.location`.
Splitting region into user-level and farm-level while that duplication stands would produce
two controls writing different meanings into one field.

A third problem is that region is currently stored in **two databases**. `Settings.tsx:146-170`
writes it to Firestore (`users/{uid}.location`) and to Postgres (`User.region`, via
`PATCH /users/profile`). The Postgres write is wrapped in a nested `try/catch` that only logs
on failure (line 168) while the user still sees "Settings saved successfully", so the two
stores can diverge silently. The consumers then disagree: the dashboard reads Postgres
(`dashboard.controller.ts:15`) while `Planning.tsx:53` reads Firestore. Two pages can show
weather for two different places. Region storage must be unified before it is also split by
farm, or the number of possible inconsistent states multiplies.

## Goals

- Region becomes a property of a farm, and drives that farm's weather.
- Soil type, irrigation, and planting season are recorded per farm.
- Personal settings and farm settings are visually and structurally separate.
- Region has exactly one source of truth, and every consumer reads it the same way.
- Existing farms and users keep working with no manual intervention.

## Non-Goals

- Soil, irrigation, and season do **not** drive any behaviour in this project. They are stored
  and displayed only.
- No disease-relevance ranking, no generated planting or task advice. Those need an agronomy
  source of truth and are a separate project.
- No further decomposition of `Settings.tsx` beyond removing the duplication.

## Design

### 1. Data model

Four nullable columns on `Farm`:

```prisma
model Farm {
  region          String?   // Kenya region — drives weather
  soilType        String?   // recorded only
  irrigation      String?   // recorded only
  plantingSeason  String?   // recorded only
  location        String?   // EXISTING — becomes free-text address
}
```

`User.region` is unchanged and retained.

**Migration.** `Farm.location` mostly holds a region name — the create-farm dialog writes
`KENYA_REGIONS` values into it (`Settings.tsx:190-193`, default `"Central Kenya"`). The
migration backfills `region` from `location`, so farms created through that dialog get a
correct region with no data loss and no backfill script for the user to run.

The backfill must **whitelist against the known region list rather than copy blindly.**
`auth.middleware.ts:72` auto-provisions every new user a farm named "Main Field" with
`location: 'Kenya'` — which is not a valid region and has no coordinates. A blind copy would
set `region = 'Kenya'`, which then misses the coordinate map and silently resolves to the
Nyeri fallback (`weather.ts:12`), showing plausible-but-wrong weather. Values not in the
region list backfill to `null`, which surfaces the honest "set a region" prompt instead.

`auth.middleware.ts:72` is also fixed to stop writing `'Kenya'`: new auto-provisioned farms
get `region: null` and inherit the user's region through the resolution rule below.

`location` is then repurposed as an optional human-readable address ("Nyeri, plot 4").

### 2. Region resolution

A single helper, used everywhere a region is needed:

```
resolveRegion(farm, user) = farm?.region ?? user.region ?? null
```

`null` means genuinely unset and the UI must say so. This replaces the
`user?.region || 'Central Kenya'` fallback at `dashboard.controller.ts:15`. That hardcoded
default is why the dashboard can never distinguish "no region set" from "weather fetch
failed" — it always had a region, so the empty state lied.

Resolution order, all four cases:

| Farm selected | `farm.region` | `user.region` | Result |
|---|---|---|---|
| yes | set | any | farm's region |
| yes | null | set | user's region |
| yes | null | null | `null` → prompt |
| no | — | set | user's region |

### 3. One source of truth for region

**Postgres is authoritative.** Region must live beside `Farm`, which only exists in Postgres,
so Firestore cannot hold the farm-scoped half of this data.

- `Settings.tsx` stops writing `location`/`units`/`language` to Firestore. Firestore retains
  only what it already owns and this project does not touch: `avatarUrl` and `full_name`.
- `Planning.tsx:45-60` stops reading region from Firestore. It consumes the same API-provided
  region as the dashboard, via `resolveRegion()`, so both pages agree by construction.
- The `PATCH /users/profile` failure at `Settings.tsx:161-169` stops being swallowed. If the
  write fails the user sees an error instead of "Settings saved successfully".

This removes the split-brain rather than extending it. Firestore's existing `location` values
are not migrated: Postgres `User.region` is already written on every save, so it is current
for any user who has saved settings, and the resolution rule covers the rest by falling
through to the prompt.

### 4. Shared region list

`KENYA_REGIONS` currently lives only in the frontend, while `weather.ts:2-9` keeps a separate
coordinate map keyed by the same strings. Nothing enforces that the two agree; a typo on
either side silently resolves to the Nyeri fallback (`weather.ts:12`).

Move the region list and its coordinates into `packages/shared-types` as one exported
structure, consumed by both backend and frontend. This is the same failure class as the
`farmNote.controller` casing crash — an identifier duplicated across files with no compiler
link between the copies.

### 5. Backend

- `dashboard.controller.ts` — load the farm identified by the existing `farmId` query param
  (already read at line 18), apply `resolveRegion()`, and return `region` alongside a
  `regionSource` of `"farm"` / `"user"` / `null` so the UI can explain what it is showing.
- `farm.controller.ts` — accept `region`, `soilType`, `irrigation`, `plantingSeason` on
  create; add an update endpoint accepting the same fields.

### 6. Frontend

**Step 1 — de-duplicate `Settings.tsx`.** Delete lines 453-592: the Farm Preferences,
Notifications, Security, and Account blocks nested inside the profile pane. Verified safe —
the dedicated panes are strict supersets (Farm 11 vs 6 bound controls, Security 3 vs 1,
Account 2 vs 1; Notifications identical with no content unique to the copy). After deletion
`activeSection === "profile"` renders Personal Information only, and the file drops to ~760
lines.

**Pane contents after the split:**

- **Profile** — name, email, phone, avatar, **Preferred Units**, **Language**. Units and
  language move here from Farm Preferences: they govern how the operator reads the app, not
  where any farm is. Leaving them under "Farm Preferences" is what made that pane a grab-bag.
- **Farm Preferences** — "Home region" (the user's, which pre-fills new farms) at the top,
  then the farm list, each farm with an Edit dialog for region, soil type, irrigation, and
  planting season.

**Dashboard.** The weather card shows the active farm's region and refetches on switch. The
effect at `Dashboard.tsx:75` already depends on `activeFarmId`, so this needs no new wiring.

**Planning.** `Planning.tsx:45-60` is the app's second weather consumer and currently resolves
its own region from Firestore with an independent `|| "Central Kenya"` default. It switches to
the API-provided region and follows the active farm, exactly as the dashboard does. Its weather
error state (`Planning.tsx:175`) gets the same three-state treatment.

**Honest weather states.** `Dashboard.tsx:154-159` currently renders
`"Weather unavailable — set your region in Settings"` whenever `weather` is null, which
includes a failed fetch. It becomes three distinct states:

| Condition | UI |
|---|---|
| loading | skeleton |
| `region == null` | "Set a region for this farm" → links to the farm's editor |
| fetch failed | "Couldn't load weather" + retry |

### 7. Error handling

- Weather fetch failure must not block dashboard render. Today the weather call sits inside
  the same `try` as `getDashboardData()` (`Dashboard.tsx:45-66`), so any earlier throw skips
  it silently. Weather moves to its own error boundary so the two failures stay distinguishable.
- A farm region not present in the shared region list resolves to `null` and surfaces the
  "set a region" state rather than silently falling back to Nyeri.
- Farm update rejects unknown region values.

## Testing

- **Migration:** a farm with `location = "Rift Valley"` backfills to `region = "Rift Valley"`;
  a farm with `location = "Kenya"` backfills to `region = null`, not to the Nyeri fallback.
- **`resolveRegion()`:** unit tests for all four rows of the resolution table.
- **Dashboard:** switching active farm changes the region used for the weather request.
- **Dashboard and Planning agree:** both render the same region for the same active farm.
  This is the regression test for the split-brain described in Problem.
- **Weather states:** each of the three states renders for its condition; a fetch failure does
  not render the "set your region" prompt.
- **Settings:** the profile pane renders exactly one section header.
- **Save failure surfaces:** a failing `PATCH /users/profile` shows an error, not a success toast.

## Order of Work

1. De-duplicate `Settings.tsx`; move Units and Language to Profile
2. Migration: four `Farm` columns, whitelisted backfill of `region` from `location`;
   fix `auth.middleware.ts:72` to stop writing `'Kenya'`
3. `resolveRegion()` + shared region list in `packages/shared-types`
4. Unify region storage on Postgres: `Settings.tsx` stops writing region to Firestore,
   `Planning.tsx` stops reading it from Firestore, save failures surface
5. Backend: farm-scoped region in dashboard; farm create/update accept new fields
6. Frontend: per-farm editor, dashboard and Planning follow active farm, honest weather states

Step 1 must land before step 6 — wiring per-farm region into a component with two live copies
of the Region control would produce a bug that is very hard to reason about. Step 4 must land
before step 6 for the same reason at the data layer: splitting region by farm while it still
lives in two databases multiplies the inconsistent states rather than resolving them.

## Risks

- **Step 1 deletes ~140 lines of rendering UI.** Verified duplicate by comparison (dedicated
  panes are strict supersets; Notifications has no content unique to the copy), but the
  deletion should be a reviewable standalone commit.
- **The migration repurposes `location`.** Every reader must be updated in the same change.
  Full list, verified: `dashboard.controller.ts:23`, `farm.controller.ts:43`,
  `farm.validator.ts:5`, `auth.middleware.ts:72`.
- **Dropping Firestore as a region store is one-way.** Any user whose Postgres sync previously
  failed silently keeps their Firestore value only until they next save. Accepted: the
  resolution rule degrades to the "set a region" prompt rather than to wrong weather.
