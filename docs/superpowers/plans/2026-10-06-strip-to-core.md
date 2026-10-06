# Strip to Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut FarmAssist down to the WhatsApp channel, AI inference and a small dashboard, move diagnosis entirely server-side, and make every diagnosis leave behind a training example (image, model output, model identity, a slot for a verified label).

**Architecture:** The backend's `POST /scans` takes the image, and `scanService.diagnoseAndRecord` stores the image, runs `openaiVision.diagnose` and writes the Scan with the full capture. That is the only place a diagnosis is written. The BullMQ AI queue, the Firestore data paths, and every page, route and model outside the core are deleted. Prisma becomes the single profile store; Firebase is kept for Auth only.

**Tech Stack:** Express 5 + Prisma 7 (Postgres) + ioredis, React 18 + Vite + shadcn/ui, Firebase Auth, OpenAI vision API, tsx for scripts.

**Spec:** `docs/superpowers/specs/2026-10-06-strip-to-core-design.md`

**Followed by:** Plan 2 (Conversational Diagnosis Core, `docs/superpowers/specs/2026-10-06-conversational-diagnosis-core-design.md`), which is written after this plan lands and replaces `openaiVision.diagnose` with the `classify_image` tool.

## Global Constraints

- Supported crops: the `trainedCrops` in `packages/ai/class-manifest.json` (Coffee, Tomato, Pepper, Bean, Potato, Cashew). Never hard-code a crop list anywhere else.
- Scan images are farm data and the core asset: they are stored under `apps/backend/data/scans/`, are **never** served over HTTP, and the directory is gitignored and mounted as a Docker volume.
- The client never supplies a diagnosis. `POST /scans` accepts only `{ imageBase64, farmId? }`.
- Image limits at the API boundary: `image/jpeg`, `image/png` or `image/webp` data URLs, at most 10 MB decoded.
- A scan verified by anyone other than `farmer` is never overwritten by a farmer verification.
- Firestore is not read or written anywhere after this plan. Firebase Auth stays.
- Schema changes are applied with `npx prisma db push` (no migrations directory exists). **Take a `pg_dump` first.** This drops the `Notification`, `Task`, `Crop`, `Agrovet`, `Product` and `NewsItem` tables.
- Commit messages carry no AI attribution lines.
- Do not touch `AImodel/`, the WhatsApp channel code (`apps/backend/src/channels/whatsapp/*`), or the landing page components.

## Review Focus

- **A data URL with a wrong or missing MIME prefix, or bytes that are not base64.** Expected: 400 with a short message, no file written, no OpenAI call. Pinned in Task 4's integration checks.
- **The same image scanned twice.** Expected: one image file on disk (content-addressed), two Scan rows. Pinned in Task 4.
- **A farmer re-verifying a scan an agronomist already labelled.** Expected: the agronomist label survives. Pinned in Task 4.
- **OpenAI failing or returning malformed JSON.** Expected: 502, the image stays stored, no Scan row is created, and the frontend shows a retry toast. Pinned in Task 4 (stub throws).
- **A user whose only profile data was in Firestore** (full name, avatar). Expected: after the change the name comes from the Prisma `firstName`/`lastName` written at signup or from the Firebase display name, and the avatar from `User.avatarUrl`, which the avatar upload already writes. Checked manually in Task 7.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `packages/ai/index.ts` | `openaiVision.diagnose(image, mimeType)`: OpenAI call restricted to manifest crops, cached by model and image hash, returns `{ analysis, model }` | 4 |
| `apps/backend/src/services/imageStore.service.ts` (new) | `parseImageDataUrl`, `saveScanImage`: the trust-boundary parser and content-addressed storage | 4 |
| `apps/backend/src/services/scan.service.ts` | adds `diagnoseAndRecord`, `verifyScan`; `createScan` gains `analysis` and `model` | 4 |
| `apps/backend/src/controllers/scan.controller.ts` | new `POST /scans` contract, `PATCH /scans/:id/verify` | 4 |
| `apps/backend/src/controllers/dashboard.controller.ts` | returns only user, farms, recent scans and scan count | 2 |
| `apps/backend/src/controllers/user.controller.ts` | adds `getMe` | 7 |
| `apps/backend/prisma/schema.prisma` | drops 6 models, adds 4 Scan columns | 3 |
| `apps/backend/scripts/integration-test.ts` | provisioning probe moves to `/dashboard`; scan, verify and profile checks | 2, 4, 7 |
| `apps/frontend/src/features/scan/Scan.tsx` | rewritten: pick or capture → POST → result → "Was this right?" → history | 5 |
| `apps/frontend/src/services/scans.service.ts` | typed `diagnose`, `list`, `verify` | 5 |
| `apps/frontend/src/pages/Settings.tsx` | rewritten: Profile, Farm, Account; API only | 7 |
| `apps/frontend/src/components/DashboardLayout.tsx` | one data fetch, core nav only, no bell, no Firestore | 6, 7 |
| `apps/frontend/src/pages/Dashboard.tsx` | weather, quick scan, farm and scan counts, recent scans | 6 |

---

### Task 1: Baseline and backup

**Files:** none changed.

- [ ] **Step 1: Create the working branch**

```bash
git checkout main && git pull --ff-only
git checkout -b feat/strip-to-core
```

- [ ] **Step 2: Dump the dev database and the image directory**

Run (the Postgres container from `docker-compose.yml` must be up):
```bash
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d farmassist > ../farmassist-pre-strip-$(date +%Y%m%d).sql
ls -la ../farmassist-pre-strip-*.sql
```
Expected: a non-empty `.sql` file outside the repo. Do not continue without it.

- [ ] **Step 3: Record the baseline**

```bash
npm run build --workspace=vite_react_shadcn_ts 2>&1 | tail -5
(cd apps/backend && npx tsc --noEmit 2>&1 | tail -5)
npm run test:ai --workspace=backend 2>&1 | tail -2
```
Write the three results into the task notes. Later tasks must not be worse than this baseline. If the baseline already fails, note the exact errors so they are not blamed on this plan.

---

### Task 2: Backend cut

**Files:**
- Delete: `apps/backend/src/routes/{agrovet,disease,farmnote,iot,notification,product,task}.routes.ts`
- Delete: `apps/backend/src/controllers/{agrovet,disease,farmNote,iot,notification,product,task}.controller.ts`
- Delete: `apps/backend/src/services/notification.service.ts`
- Modify: `apps/backend/src/app.ts`
- Modify: `apps/backend/src/controllers/dashboard.controller.ts`
- Modify: `packages/shared-types/index.ts`
- Modify: `apps/backend/scripts/integration-test.ts`

`crop.routes.ts` / `crop.controller.ts` stay until Task 4, because the current Scan page still calls `/crops/analyze`. `farmNote.service.ts` stays: it holds the idempotent `createNoteForMessage` the WhatsApp farm-log milestone needs. It has no caller after this task.

**Interfaces:**
- Produces: `GET /api/v1/dashboard` → `DashboardData` (below), used by Tasks 6 and 7.

- [ ] **Step 1: Update the integration test first (it should fail)**

In `apps/backend/scripts/integration-test.ts`:

1. Replace every provisioning probe `fetch(\`${base}/api/v1/agrovets\`, { headers: AUTH })` with `fetch(\`${base}/api/v1/dashboard\`, { headers: AUTH })`. There are four: lines 90, 107, 166 and 204 in the current file.
2. Delete the whole agrovet block: the seeding of `SEED_TENANT` and everything from `res = await fetch(\`${base}/api/v1/agrovets\`, { headers: AUTH });` through `check('agrovet routes reject an unauthenticated caller', ...)`. Also delete `SEED_TENANT` and its cleanup in `cleanup()`.
3. Delete the task and farm-note intrusion checks, the `intruded` task count, and the "farm owner can still create a task" check. Keep the scan intrusion check for now; Task 4 rewrites it.
4. Add, after the provisioning checks:

```ts
  res = await fetch(`${base}/api/v1/dashboard`, { headers: AUTH });
  const dash: any = await res.json();
  check('GET /dashboard returns 200', res.status === 200, `status=${res.status}`);
  check('dashboard lists the default farm', Array.isArray(dash.farms) && dash.farms.length === 1);
  check('dashboard has no removed fields', !('alerts' in dash) && !('news' in dash) && !('stats' in dash));

  for (const gone of ['agrovets', 'tasks', 'farm-notes', 'notifications', 'products', 'diseases', 'iot/telemetry']) {
    res = await fetch(`${base}/api/v1/${gone}`, { headers: AUTH });
    check(`/${gone} is gone`, res.status === 404, `status=${res.status}`);
  }
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `DATABASE_URL='postgresql://<user>:<pass>@localhost:5432/farmassist' npm run test:integration --workspace=backend`
Expected: FAIL on `dashboard has no removed fields` and on every `/... is gone` check.

- [ ] **Step 3: Delete the files**

```bash
cd apps/backend/src
git rm routes/agrovet.routes.ts routes/disease.routes.ts routes/farmnote.routes.ts routes/iot.routes.ts routes/notification.routes.ts routes/product.routes.ts routes/task.routes.ts
git rm controllers/agrovet.controller.ts controllers/disease.controller.ts controllers/farmNote.controller.ts controllers/iot.controller.ts controllers/notification.controller.ts controllers/product.controller.ts controllers/task.controller.ts
git rm services/notification.service.ts
```

- [ ] **Step 4: Remove the mounts from `app.ts`**

Replace the import and mount block (from `import farmRoutes` through `app.use('/api/v1/agrovets', agrovetRoutes);`) with:

```ts
import farmRoutes from './routes/farm.routes';
import cropRoutes from './routes/crop.routes';
import dashboardRoutes from './routes/dashboard.routes';
import scanRoutes from './routes/scan.routes';
import userRoutes from './routes/user.routes';
import whatsappWebhookRoutes from './channels/whatsapp/webhook.route';
import path from 'path';

app.use('/api/v1/public', express.static(path.join(__dirname, '../public')));

app.use('/api/v1/farms', farmRoutes);
app.use('/api/v1/crops', cropRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/scans', scanRoutes);
app.use('/api/v1/users', userRoutes);
```

Leave the WhatsApp webhook mount and the error handler unchanged.

- [ ] **Step 5: Slim the dashboard controller**

Replace the body of `apps/backend/src/controllers/dashboard.controller.ts` with:

```ts
import { Request, Response } from 'express';
import { prisma } from '@farmassist/database';

export const getDashboardData = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const farmId = req.query.farmId as string | undefined;
        const scanFilter = { userId, ...(farmId ? { farmId } : {}) };

        const [user, farms, recentScans, totalScans] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: { firstName: true, lastName: true, avatarUrl: true, region: true },
            }),
            prisma.farm.findMany({
                where: { tenant: { members: { some: { userId } } } },
                select: { id: true, name: true, location: true },
            }),
            prisma.scan.findMany({ where: scanFilter, orderBy: { createdAt: 'desc' }, take: 5 }),
            prisma.scan.count({ where: scanFilter }),
        ]);

        return res.status(200).json({
            user: { firstName: user?.firstName ?? null, lastName: user?.lastName ?? null, avatarUrl: user?.avatarUrl ?? null },
            userRegion: user?.region || 'Central Kenya',
            farms,
            activeFarmId: farmId || farms[0]?.id || null,
            recentScans,
            totalScans,
        });
    } catch (error: any) {
        console.error('Dashboard Data Error:', error);
        return res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
};
```

- [ ] **Step 6: Update the shared type**

In `packages/shared-types/index.ts`, replace `DashboardData`, and delete `DiseaseData`, `Product` and `ScanResult`. Nothing imports them after Tasks 5–6, and Plan 2 defines the classifier types in `packages/ai`.

```ts
export interface DashboardFarm {
  id: string;
  name: string;
  location: string | null;
}

export interface DashboardData {
  user: { firstName: string | null; lastName: string | null; avatarUrl: string | null };
  userRegion: string;
  farms: DashboardFarm[];
  activeFarmId: string | null;
  recentScans: any[];
  totalScans: number;
}
```

- [ ] **Step 7: Typecheck and run the integration test**

```bash
(cd apps/backend && npx tsc --noEmit)
DATABASE_URL='...' npm run test:integration --workspace=backend
```
Expected: `tsc` clean. Every check passes, including the scan intrusion check (403). The frontend build is allowed to fail until Task 6, because the frontend still reads `alerts`, `stats` and `systemMode`.

- [ ] **Step 8: Commit**

```bash
git add -A apps/backend packages/shared-types
git commit -m "refactor(backend): remove agrovet, task, note, notification, product, disease and IoT APIs"
```

---

### Task 3: Schema

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

**Interfaces:**
- Produces: `Scan.analysis Json?`, `Scan.model String?`, `Scan.verifiedLabel String?`, `Scan.verifiedBy String?`, used in Task 4.

- [ ] **Step 1: Edit the schema**

1. In `model User`, delete the lines `tasks Task[]` and `notifications Notification[]`.
2. In `model Tenant`, delete `agrovets Agrovet[]`.
3. In `model Farm`, delete `crops Crop[]` and `tasks Task[]`.
4. Delete the whole `model Crop`, `model Task`, `model Notification`, `model Agrovet`, `model Product` and `model NewsItem` blocks.
5. In `model Scan`, after `reviewStatus`, add:

```prisma
  // Training-example capture (strip-to-core spec §4.1). Every diagnosis
  // writes analysis and model; the verified label arrives later from the
  // farmer ("farmer") or an agronomist ("agronomist:<userId>").
  analysis      Json?
  model         String?
  verifiedLabel String?
  verifiedBy    String?
```

`TenantType.AGROVET` stays: removing an enum value from a populated column fails the push, and it costs nothing.

- [ ] **Step 2: Confirm nothing still references the removed models**

Run: `grep -rnE "prisma\.(task|notification|crop|agrovet|product|newsItem)\b" apps/backend/src packages apps/backend/scripts scripts tests`
Expected: no output.

- [ ] **Step 3: Push and regenerate**

The pg_dump from Task 1 Step 2 must exist.
```bash
cd apps/backend && npx prisma db push --accept-data-loss && npx prisma generate && npx tsc --noEmit
```
Expected: "Your database is now in sync", and `tsc` is clean.

- [ ] **Step 4: Run the integration test**

Run: `DATABASE_URL='...' npm run test:integration --workspace=backend`
Expected: all checks pass, as at the end of Task 2.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema.prisma
git commit -m "feat(db): drop unused models, add training-capture columns to Scan"
```

---

### Task 4: Server-side diagnosis with training-example capture

**Files:**
- Modify: `packages/ai/index.ts`
- Create: `apps/backend/src/services/imageStore.service.ts`
- Modify: `apps/backend/src/services/scan.service.ts`
- Modify: `apps/backend/src/controllers/scan.controller.ts`
- Modify: `apps/backend/src/routes/scan.routes.ts`
- Delete: `apps/backend/src/routes/crop.routes.ts`, `apps/backend/src/controllers/crop.controller.ts`, `infrastructure/queue/`
- Modify: `apps/backend/src/app.ts`, `apps/backend/Dockerfile`, `docker-compose.yml`, `.gitignore`
- Modify: `apps/backend/scripts/integration-test.ts`

**Interfaces:**
- Consumes: Scan columns from Task 3.
- Produces:
  - `openaiVision.diagnose(image: Buffer, mimeType: string): Promise<{ analysis: Analysis; model: string }>` from `@farmassist/ai`.
  - `type Analysis = { diseaseName: string; confidence: number; cropType: string; severity: string; symptoms: string[]; possibleCauses: string[]; treatment: string; prevention: string[] }` (confidence is 0–100).
  - `parseImageDataUrl(dataUrl: string): { bytes: Buffer; mimeType: string } | { error: string }`
  - `saveScanImage(bytes: Buffer, mimeType: string): Promise<string>` returns the key `scans/<sha256>.<ext>`.
  - `diagnoseAndRecord(origin: ScanOrigin, input: { farmId?: string | null; bytes: Buffer; mimeType: string }): Promise<{ scan: Scan; analysis: Analysis }>`
  - `verifyScan(userId: string, scanId: string, input: { correct: boolean; label?: string }): Promise<Scan | null>`
  - HTTP: `POST /api/v1/scans { imageBase64, farmId? }` → `201 { scan, analysis }`; `PATCH /api/v1/scans/:id/verify { correct, label? }` → `200 scan`.

- [ ] **Step 1: Write the failing integration checks**

In `integration-test.ts`, add `'ITEST_user_scan'` to `UIDS`, and add `const SCAN_DIR = path.join(__dirname, '../data/scans');` next to `AVATARS_DIR`. Directly after `const app = require('../src/app').default;` add the classifier stub (same pattern as the `authAdmin` stub):

```ts
const ai = require('@farmassist/ai');
let aiShouldFail = false;
ai.openaiVision.diagnose = async () => {
  if (aiShouldFail) throw new Error('stubbed OpenAI outage');
  return {
    analysis: {
      diseaseName: 'Tomato Early Blight', confidence: 91, cropType: 'Tomato', severity: 'Moderate',
      symptoms: ['concentric rings'], possibleCauses: ['fungal infection'],
      treatment: 'stub treatment', prevention: ['rotate crops'],
    },
    model: 'stub:test@00000000',
  };
};
```

At the very start of `run()`, add the following. The intrusion check further down needs these values, so they must be defined first.

```ts
  const png = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#2e7d32' } }).png().toBuffer();
  const imageBase64 = `data:image/png;base64,${png.toString('base64')}`;
  const jsonAuth = { ...AUTH, 'Content-Type': 'application/json' };
```

Replace the old scan intrusion request body `JSON.stringify({ diseaseName: 'ITEST intrusion', farmId: victimFarm.id })` with `JSON.stringify({ imageBase64, farmId: victimFarm.id })`, so the 403 is tested with a request that would otherwise succeed. Then add a new section at the end of `run()`:

```ts
  TOKEN_UID = 'ITEST_user_scan';
  await fetch(`${base}/api/v1/dashboard`, { headers: AUTH });

  res = await fetch(`${base}/api/v1/scans`, { method: 'POST', headers: jsonAuth, body: JSON.stringify({ imageBase64 }) });
  const created: any = await res.json();
  check('POST /scans diagnoses server-side', res.status === 201, `status=${res.status}`);
  check('scan stores the model output', created.scan?.analysis?.diseaseName === 'Tomato Early Blight');
  check('scan stores the model identity', created.scan?.model === 'stub:test@00000000');
  check('scan image is on disk under its key', !!created.scan?.imageUrl && fs.existsSync(path.join(SCAN_DIR, path.basename(created.scan.imageUrl))));
  check('scan image is not publicly served', (await fetch(`${base}/api/v1/public/${created.scan?.imageUrl}`)).status === 404);

  res = await fetch(`${base}/api/v1/scans`, { method: 'POST', headers: jsonAuth, body: JSON.stringify({ imageBase64, diseaseName: 'forged', confidence: 100 }) });
  const second: any = await res.json();
  check('client-supplied diagnosis is ignored', second.scan?.diseaseName === 'Tomato Early Blight');
  check('same image is stored once', second.scan?.imageUrl === created.scan?.imageUrl);

  for (const bad of ['not-a-data-url', 'data:image/gif;base64,R0lGOD', 'data:image/png;base64,@@@@']) {
    res = await fetch(`${base}/api/v1/scans`, { method: 'POST', headers: jsonAuth, body: JSON.stringify({ imageBase64: bad }) });
    check(`bad image "${bad.slice(0, 20)}" is 400`, res.status === 400, `status=${res.status}`);
  }

  aiShouldFail = true;
  const before = await prisma.scan.count({ where: { userId: 'ITEST_user_scan' } });
  res = await fetch(`${base}/api/v1/scans`, { method: 'POST', headers: jsonAuth, body: JSON.stringify({ imageBase64 }) });
  check('model failure is 502', res.status === 502, `status=${res.status}`);
  check('model failure writes no scan row', (await prisma.scan.count({ where: { userId: 'ITEST_user_scan' } })) === before);
  aiShouldFail = false;

  res = await fetch(`${base}/api/v1/scans/${created.scan.id}/verify`, { method: 'PATCH', headers: jsonAuth, body: JSON.stringify({ correct: true }) });
  const verified: any = await res.json();
  check('farmer can confirm their scan', res.status === 200 && verified.verifiedLabel === 'Tomato Early Blight' && verified.verifiedBy === 'farmer');

  res = await fetch(`${base}/api/v1/scans/${second.scan.id}/verify`, { method: 'PATCH', headers: jsonAuth, body: JSON.stringify({ correct: false, label: 'Late blight' }) });
  check('farmer can correct their scan', (await res.json() as any).verifiedLabel === 'Late blight');

  await prisma.scan.update({ where: { id: created.scan.id }, data: { verifiedLabel: 'Septoria', verifiedBy: 'agronomist:ITEST' } });
  await fetch(`${base}/api/v1/scans/${created.scan.id}/verify`, { method: 'PATCH', headers: jsonAuth, body: JSON.stringify({ correct: false, label: 'x' }) });
  const kept = await prisma.scan.findUnique({ where: { id: created.scan.id } });
  check('farmer cannot overwrite an agronomist label', kept?.verifiedLabel === 'Septoria');

  TOKEN_UID = 'ITEST_user_outsider';
  res = await fetch(`${base}/api/v1/scans/${second.scan.id}/verify`, { method: 'PATCH', headers: jsonAuth, body: JSON.stringify({ correct: true }) });
  check("outsider cannot verify someone else's scan", res.status === 404, `status=${res.status}`);

  res = await fetch(`${base}/api/v1/crops/analyze`, { method: 'POST', headers: jsonAuth, body: '{}' });
  check('/crops/analyze is gone', res.status === 404, `status=${res.status}`);
```

In `cleanup()`, before the users are deleted, add the following. Scans cascade with their user; only the image files need explicit removal.

```ts
  const scans = await prisma.scan.findMany({ where: { userId: { in: UIDS } }, select: { imageUrl: true } });
  for (const s of scans) if (s.imageUrl) fs.rmSync(path.join(SCAN_DIR, path.basename(s.imageUrl)), { force: true });
```

- [ ] **Step 2: Run and confirm failure**

Run: `DATABASE_URL='...' npm run test:integration --workspace=backend`
Expected: it crashes with `Cannot set properties of undefined (setting 'diagnose')`, because `openaiVision` doesn't exist yet.

- [ ] **Step 3: Rewrite the OpenAI call in `packages/ai/index.ts`**

Replace everything from `const MAX_IMAGE_SIZE_BYTES` to the end of the file with the code below. Keep the existing system prompt text, with the crop-restriction rule inserted as shown.

```ts
import { loadClassManifest } from './manifest';

export interface Analysis {
    diseaseName: string;
    confidence: number; // 0-100
    cropType: string;
    severity: string;
    symptoms: string[];
    possibleCauses: string[];
    treatment: string;
    prevention: string[];
}

const SUPPORTED_CROPS = loadClassManifest().trainedCrops;

const SYSTEM_PROMPT = `<the existing systemPrompt text, unchanged up to "Diagnostic Rules:">

Supported crops: ${SUPPORTED_CROPS.join(', ')}.
0. If the crop is not one of the supported crops, return "diseaseName": "Unsupported crop", the identified "cropType", "confidence": 0, "severity": "Healthy", empty arrays, and "treatment": "". Do not diagnose it.

<the existing "Diagnostic Rules:" list and closing text, unchanged>`;

const sha256 = (data: string | Buffer) => crypto.createHash('sha256').update(data).digest('hex');

/**
 * Wrapped in an object so tests can replace diagnose, the same way the
 * integration test stubs authAdmin.verifyIdToken.
 */
export const openaiVision = {
    diagnose: async (image: Buffer, mimeType: string): Promise<{ analysis: Analysis; model: string }> => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OpenAI API key missing');

        const aiModel = process.env.AI_MODEL || 'gpt-4o';
        // The prompt hash is part of the identity: a prompt change is a new
        // model as far as training labels are concerned.
        const model = `openai:${aiModel}@${sha256(SYSTEM_PROMPT).slice(0, 8)}`;
        const cacheKey = `crop_analysis:${model}:${sha256(image)}`;

        const cached = await redis.get(cacheKey);
        if (cached) return { analysis: JSON.parse(cached), model };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: aiModel,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Please analyze this crop image for any diseases or health issues.' },
                            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${image.toString('base64')}`, detail: 'high' } },
                        ],
                    },
                ],
                max_tokens: 1500,
                temperature: 0.2,
                response_format: { type: 'json_object' },
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenAI API Failed: ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('No content returned from OpenAI');

        const analysis = JSON.parse(content) as Analysis;
        if (typeof analysis.diseaseName !== 'string' || typeof analysis.confidence !== 'number') {
            throw new Error('OpenAI returned an analysis without diseaseName/confidence');
        }

        const ttl = process.env.AI_CACHE_TTL ? parseInt(process.env.AI_CACHE_TTL, 10) : 604800;
        await redis.setex(cacheKey, ttl, JSON.stringify(analysis));
        return { analysis, model };
    },
};
```

`analyzeCropImage` and `MAX_IMAGE_SIZE_BYTES` are gone; the size check moves to the API boundary (Step 4).

- [ ] **Step 4: Create `apps/backend/src/services/imageStore.service.ts`**

```ts
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/**
 * Scan images are the training set, so they are kept out of public/ and are
 * never served. Content-addressed: the same photo uploaded twice is one file.
 */
// ponytail: local disk; move to object storage when the backend runs on more than one host.
export const SCAN_IMAGE_DIR = process.env.SCAN_IMAGE_DIR || path.join(__dirname, '../../data/scans');

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export function parseImageDataUrl(dataUrl: unknown): { bytes: Buffer; mimeType: string } | { error: string } {
    if (typeof dataUrl !== 'string') return { error: 'imageBase64 must be a data URL string' };
    const match = DATA_URL.exec(dataUrl);
    if (!match) return { error: 'imageBase64 must be a JPEG, PNG or WebP data URL' };
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length === 0) return { error: 'Image is empty' };
    if (bytes.length > MAX_IMAGE_BYTES) return { error: 'Image exceeds 10MB' };
    return { bytes, mimeType: match[1] };
}

export async function saveScanImage(bytes: Buffer, mimeType: string): Promise<string> {
    const name = `${crypto.createHash('sha256').update(bytes).digest('hex')}.${EXTENSIONS[mimeType] ?? 'bin'}`;
    await fs.mkdir(SCAN_IMAGE_DIR, { recursive: true });
    try {
        await fs.writeFile(path.join(SCAN_IMAGE_DIR, name), bytes, { flag: 'wx' });
    } catch (error: any) {
        if (error?.code !== 'EEXIST') throw error;
    }
    return `scans/${name}`;
}
```

- [ ] **Step 5: Extend `scan.service.ts`**

At the top, add:
```ts
import { openaiVision, type Analysis } from '@farmassist/ai';
import { saveScanImage } from './imageStore.service';
```

Add `analysis?: Analysis | null;` and `model?: string | null;` to `interface ScanResult`. In `createScan`'s `data`, add:
```ts
      analysis: (result.analysis ?? undefined) as any,
      model: result.model ?? null,
```

Append:

```ts
/**
 * The one place a diagnosis is written. Every surface (dashboard now,
 * WhatsApp and Telegram later) calls this, so every diagnosis leaves a
 * training example: the stored image, the raw model output and the model id.
 * The image is stored before the model runs, so a failed call still keeps it.
 */
export async function diagnoseAndRecord(
  origin: ScanOrigin,
  input: { farmId?: string | null; bytes: Buffer; mimeType: string }
) {
  const imageUrl = await saveScanImage(input.bytes, input.mimeType);
  const { analysis, model } = await openaiVision.diagnose(input.bytes, input.mimeType);
  const scan = await createScan(origin, {
    farmId: input.farmId ?? null,
    imageUrl,
    diseaseName: analysis.diseaseName,
    confidence: analysis.confidence,
    treatment: analysis.treatment || null,
    analysis,
    model,
  });
  return { scan, analysis };
}

/** Returns null when the scan does not exist or is not the caller's. */
export async function verifyScan(
  userId: string,
  scanId: string,
  input: { correct: boolean; label?: string }
) {
  const scan = await prisma.scan.findUnique({ where: { id: scanId } });
  if (!scan || scan.userId !== userId) return null;
  // An agronomist's label outranks the farmer's.
  if (scan.verifiedBy && scan.verifiedBy !== 'farmer') return scan;

  const verifiedLabel = input.correct
    ? scan.diseaseName
    : (input.label?.trim().slice(0, 100) || 'rejected');

  return prisma.scan.update({
    where: { id: scanId },
    data: { verifiedLabel, verifiedBy: 'farmer' },
  });
}
```

- [ ] **Step 6: Replace `createScan` in `scan.controller.ts` and add `verifyScan`**

Add `import { parseImageDataUrl } from '../services/imageStore.service';`, then replace the `createScan` export with:

```ts
export const createScan = async (req: Request, res: Response): Promise<any> => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Only the image and farm are accepted. Any diagnosis fields in the body
    // are ignored: the server is the only source of a diagnosis.
    const { imageBase64, farmId } = req.body ?? {};

    if (farmId && !(await userCanAccessFarm(userId, farmId))) {
        return res.status(403).json({ error: 'You do not have access to this farm' });
    }

    const image = parseImageDataUrl(imageBase64);
    if ('error' in image) {
        return res.status(400).json({ error: image.error });
    }

    try {
        const { scan, analysis } = await scanService.diagnoseAndRecord(
            { userId },
            { farmId, bytes: image.bytes, mimeType: image.mimeType }
        );
        return res.status(201).json({ scan, analysis });
    } catch (error: any) {
        console.error('Diagnosis Error:', error);
        return res.status(502).json({ error: 'Diagnosis failed. Please try again.' });
    }
};

export const verifyScan = async (req: Request, res: Response): Promise<any> => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { correct, label } = req.body ?? {};
    if (typeof correct !== 'boolean') {
        return res.status(400).json({ error: '"correct" must be true or false' });
    }
    try {
        const scan = await scanService.verifyScan(userId, String(req.params.id), {
            correct,
            label: typeof label === 'string' ? label : undefined,
        });
        if (!scan) return res.status(404).json({ error: 'Scan not found' });
        return res.status(200).json(scan);
    } catch (error: any) {
        console.error('Verify Scan Error:', error);
        return res.status(500).json({ error: 'Failed to verify scan' });
    }
};
```

- [ ] **Step 7: Routes and rate limit**

Replace `apps/backend/src/routes/scan.routes.ts` with:

```ts
import { Router } from 'express';
import { getScans, createScan, verifyScan } from '../controllers/scan.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { rateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

router.get('/', requireAuth, getScans);
// Each POST is a paid model call; same budget /crops/analyze had.
router.post('/', requireAuth, rateLimiter({ windowSeconds: 3600, maxRequests: 20 }), createScan);
router.patch('/:id/verify', requireAuth, verifyScan);

export default router;
```

Then delete the AI queue path:

```bash
git rm apps/backend/src/routes/crop.routes.ts apps/backend/src/controllers/crop.controller.ts
git rm -r infrastructure/queue
```

In `app.ts`, delete `import cropRoutes from './routes/crop.routes';` and `app.use('/api/v1/crops', cropRoutes);`. In `apps/backend/Dockerfile`, delete the line `COPY infrastructure/queue/package.json ./infrastructure/queue/package.json`. Run `npm install` at the repo root so the lockfile drops the workspace.

- [ ] **Step 8: Storage volume and ignore rule**

In `docker-compose.yml`, under `backend.volumes`, add:
```yaml
      - ./apps/backend/data:/app/apps/backend/data
```
In the root `.gitignore`, under `# Runtime-uploaded user media (never source)`, add:
```
/apps/backend/data/
```

- [ ] **Step 9: Run tests and typecheck**

```bash
(cd apps/backend && npx tsc --noEmit)
npm run test:ai --workspace=backend
DATABASE_URL='...' npm run test:integration --workspace=backend
```
Expected: `tsc` clean, the AI manifest tests pass, and every integration check passes, including all of Step 1's checks.

- [ ] **Step 10: Commit**

```bash
git add -A apps/backend packages/ai infrastructure docker-compose.yml .gitignore package-lock.json
git commit -m "feat(scan): diagnose server-side and capture a training example on every scan"
```

---

### Task 5: Scan page

**Files:**
- Rewrite: `apps/frontend/src/features/scan/Scan.tsx`
- Rewrite: `apps/frontend/src/services/scans.service.ts`
- Delete: `apps/frontend/src/lib/openai_vision_api.ts`, `apps/frontend/src/lib/disease_fallback.ts`, `apps/frontend/src/lib/products.ts`

**Interfaces:**
- Consumes: `POST /scans`, `GET /scans`, `PATCH /scans/:id/verify` from Task 4.

- [ ] **Step 1: Rewrite `scans.service.ts`**

```ts
import { apiClient } from '../api/client';

export interface Analysis {
  diseaseName: string;
  confidence: number;
  cropType: string;
  severity: string;
  symptoms: string[];
  possibleCauses: string[];
  treatment: string;
  prevention: string[];
}

export interface ScanRow {
  id: string;
  farmId: string | null;
  diseaseName: string | null;
  confidence: number | null;
  analysis: Analysis | null;
  verifiedLabel: string | null;
  verifiedBy: string | null;
  createdAt: string;
}

export const scansService = {
  list: async (farmId?: string | null): Promise<ScanRow[]> => {
    const { data } = await apiClient.get('/scans', { params: { farmId } });
    return data;
  },
  diagnose: async (imageBase64: string, farmId?: string | null): Promise<{ scan: ScanRow; analysis: Analysis }> => {
    const { data } = await apiClient.post('/scans', { imageBase64, farmId: farmId || undefined });
    return data;
  },
  verify: async (scanId: string, correct: boolean, label?: string): Promise<ScanRow> => {
    const { data } = await apiClient.patch(`/scans/${scanId}/verify`, { correct, label });
    return data;
  },
};
```

- [ ] **Step 2: Rewrite `Scan.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { Camera, Upload, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import CameraCapture from "@/components/CameraCapture";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useFarm } from "@/contexts/FarmContext";
import { processImageUpload } from "@/lib/image_upload_util";
import { scansService, type Analysis, type ScanRow } from "@/services/scans.service";

export default function Scan() {
  const { activeFarmId } = useFarm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{ scan: ScanRow; analysis: Analysis } | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState("");
  const [history, setHistory] = useState<ScanRow[]>([]);

  useEffect(() => {
    scansService.list(activeFarmId).then(setHistory).catch(() => setHistory([]));
  }, [activeFarmId]);

  const onFile = async (file?: File) => {
    if (!file) return;
    const processed = await processImageUpload(file);
    if (!processed.success || !processed.data) {
      toast.error(processed.error || "Could not read that image");
      return;
    }
    setImage(processed.data);
    setResult(null);
  };

  const analyze = async () => {
    if (!image) return;
    setAnalyzing(true);
    try {
      const data = await scansService.diagnose(image, activeFarmId);
      setResult(data);
      setHistory((prev) => [data.scan, ...prev]);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Diagnosis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const verify = async (correct: boolean) => {
    if (!result) return;
    try {
      const scan = await scansService.verify(result.scan.id, correct, correct ? undefined : correction);
      setResult({ ...result, scan });
      setHistory((prev) => prev.map((s) => (s.id === scan.id ? scan : s)));
      setCorrecting(false);
      toast.success("Thank you, this helps the diagnosis get better.");
    } catch {
      toast.error("Could not save your answer.");
    }
  };

  const a = result?.analysis;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-4">
        <Card>
          <CardHeader><CardTitle>Scan a crop</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {showCamera ? (
              <CameraCapture
                onCapture={(src) => { setImage(src); setResult(null); setShowCamera(false); }}
                onCancel={() => setShowCamera(false)}
              />
            ) : image ? (
              <img src={image} alt="Selected crop" className="w-full max-h-96 object-contain rounded-lg bg-gray-50" />
            ) : (
              <p className="text-sm text-gray-500">Take or upload a clear photo of the affected leaf.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowCamera(true)}><Camera className="w-4 h-4 mr-2" />Camera</Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-2" />Upload</Button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])} />
              <Button onClick={analyze} disabled={!image || analyzing}>
                {analyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Diagnose
              </Button>
            </div>
          </CardContent>
        </Card>

        {a && result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {a.diseaseName}
                <Badge variant="secondary">{Math.round(a.confidence)}%</Badge>
                <Badge variant="outline">{a.cropType}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {a.symptoms?.length > 0 && (
                <div><h4 className="font-semibold mb-1">Symptoms</h4><ul className="list-disc pl-5">{a.symptoms.map((s) => <li key={s}>{s}</li>)}</ul></div>
              )}
              {a.treatment && <div><h4 className="font-semibold mb-1">Treatment</h4><p>{a.treatment}</p></div>}
              {a.prevention?.length > 0 && (
                <div><h4 className="font-semibold mb-1">Prevention</h4><ul className="list-disc pl-5">{a.prevention.map((p) => <li key={p}>{p}</li>)}</ul></div>
              )}
              <p className="text-xs text-gray-500">This is advice, not a guarantee. Consult your agrovet if symptoms spread.</p>

              <div className="border-t pt-4">
                {result.scan.verifiedBy ? (
                  <p className="text-[#198754] font-medium">Thanks for confirming.</p>
                ) : correcting ? (
                  <div className="flex gap-2">
                    <Input value={correction} onChange={(e) => setCorrection(e.target.value)} placeholder="What is it? (optional)" maxLength={100} />
                    <Button onClick={() => verify(false)}>Send</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="font-medium">Was this right?</span>
                    <Button size="sm" variant="outline" onClick={() => verify(true)}><Check className="w-4 h-4 mr-1" />Yes</Button>
                    <Button size="sm" variant="outline" onClick={() => setCorrecting(true)}><X className="w-4 h-4 mr-1" />No</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Recent scans</CardTitle></CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-gray-500">No scans yet.</p>
            ) : (
              <ul className="divide-y">
                {history.map((s) => (
                  <li key={s.id} className="py-2 flex justify-between text-sm">
                    <span>{s.diseaseName ?? "Unknown"}{s.verifiedLabel ? ` · confirmed: ${s.verifiedLabel}` : ""}</span>
                    <span className="text-gray-500">{new Date(s.createdAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
```

- [ ] **Step 3: Delete the old helpers**

```bash
git rm apps/frontend/src/lib/openai_vision_api.ts apps/frontend/src/lib/disease_fallback.ts apps/frontend/src/lib/products.ts
```

- [ ] **Step 4: Typecheck the changed files**

Run: `cd apps/frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "features/scan|services/scans" || echo "scan files clean"`
Expected: `scan files clean`. Errors in other files belong to Tasks 6–7.

- [ ] **Step 5: Manual check**

Run `npm run dev` at the repo root and log in. Then:
1. On `/scan`, upload a tomato leaf photo and press Diagnose. A result appears.
2. Press **Yes**. "Thanks for confirming" appears.
3. Reload the page. The scan is in Recent scans with "confirmed".
4. Check that a new file exists in `apps/backend/data/scans/`.

- [ ] **Step 6: Commit**

```bash
git add -A apps/frontend/src/features/scan apps/frontend/src/services/scans.service.ts apps/frontend/src/lib
git commit -m "feat(frontend): server-side scan flow with farmer confirmation"
```

---

### Task 6: Frontend cut and dashboard home

**Files:**
- Delete: `apps/frontend/src/features/{notifications,planning,crops,farms}/`, `apps/frontend/src/pages/{FarmLogs,TodoList,Agrovet,Shop,Subscription}.tsx`, `apps/frontend/src/services/{notifications,iot}.service.ts`
- Modify: `apps/frontend/src/App.tsx`, `apps/frontend/src/components/DashboardLayout.tsx`, `apps/frontend/src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `DashboardData` from Task 2.

- [ ] **Step 1: Delete pages and services**

```bash
cd apps/frontend/src
git rm -r features/notifications features/planning features/crops features/farms
git rm pages/FarmLogs.tsx pages/TodoList.tsx pages/Agrovet.tsx pages/Shop.tsx pages/Subscription.tsx
git rm services/notifications.service.ts services/iot.service.ts
```

- [ ] **Step 2: Routes in `App.tsx`**

Delete the imports of `Farms`, `Planning`, `Trees`, `Notifications`, `Subscription`, `FarmLogs`, `TodoList`, `AgrovetMarketplace` and `Shop`. Then replace the `<Routes>` block with:

```tsx
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/scan" element={<ProtectedRoute><Scan /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
```

- [ ] **Step 3: Navigation in `DashboardLayout.tsx`**

1. Replace `getNavigationItems` with the version below, and update its two call sites to `getNavigationItems()`.
```tsx
const getNavigationItems = () => [
  { label: "Dashboard", icon: Home, route: "/dashboard" },
  { label: "Scan", icon: Camera, route: "/scan" },
  { label: "Settings", icon: Settings, route: "/settings" },
];
```
2. In `AppSidebar`, delete the `systemMode` state and the whole `useEffect` that calls `dashboardService.getDashboardData()`. This is the duplicate fetch.
3. In the header, delete the `unreadCount` state, the `setUnreadCount(...)` line, the `if (route === "/notifications") return "Notifications";` line, and the whole `<NavLink to="/notifications">…</NavLink>` bell element.
4. From the `lucide-react` import, remove the icons that are no longer used: `Map as MapIcon`, `Calendar`, `TreeDeciduous`, `Bell`, `CheckSquare`, `ShoppingBag`. Then run `npx eslint src/components/DashboardLayout.tsx` and remove whatever else it reports as unused.

The Firestore profile fetch in this file is removed in Task 7.

- [ ] **Step 4: Dashboard home in `Dashboard.tsx`**

1. Replace the `stats` state with `const [totalScans, setTotalScans] = useState(0);`, and delete the `recentAlerts` and `news` state.
2. In the fetch, replace the `setStats({...})`, `setRecentAlerts(...)` and `setNews(...)` lines with `setTotalScans(data.totalScans ?? 0);`.
3. Quick Actions: keep only the `Scan Crop` entry in the array, and change the grid class to `grid grid-cols-1 gap-6`.
4. Stats Row: replace the array with:
```tsx
            { label: "Farms", value: farms.length, sub: "Active locations", icon: Warehouse, color: "text-[#198754]", bg: "bg-[#f2f9f5]" },
            { label: "Scans", value: totalScans, sub: "Diagnoses so far", icon: Camera, color: "text-[#198754]", bg: "bg-[#f2f9f5]" },
```
   Change its grid class to `grid grid-cols-2 gap-4`. Add `const { activeFarmId, farms } = useFarm();` in place of the existing `useFarm()` destructure.
5. In the "4-Column Content Grid", delete the `{/* Farming News & Subsidies */}`, `{/* To-Do List */}` and `{/* Alerts & Activity */}` `<Card>` blocks, keeping only `{/* Recent Crop Scans */}`. Change the grid class to `grid grid-cols-1 gap-6`.
6. Remove the icons this leaves unused from the `lucide-react` import (eslint lists them).

- [ ] **Step 5: Build**

Run: `npm run build --workspace=vite_react_shadcn_ts`
Expected: success, except errors that reference `@/lib/firebase` `db` in `Settings.tsx` or `DashboardLayout.tsx` (Task 7). There are no other errors.

- [ ] **Step 6: Commit**

```bash
git add -A apps/frontend
git commit -m "refactor(frontend): remove non-core pages and slim the dashboard home"
```

---

### Task 7: One profile source and the consent line

**Files:**
- Modify: `apps/backend/src/controllers/user.controller.ts`, `apps/backend/src/routes/user.routes.ts`
- Rewrite: `apps/frontend/src/pages/Settings.tsx`
- Modify: `apps/frontend/src/components/DashboardLayout.tsx`, `apps/frontend/src/lib/firebase.ts`, `apps/frontend/src/features/auth/SignUp.tsx`
- Modify: `apps/backend/scripts/integration-test.ts`

**Interfaces:**
- Produces: `GET /api/v1/users/me` → `{ email, firstName, lastName, phone, region, preferredLanguage, avatarUrl, createdAt }`.

- [ ] **Step 1: Failing integration check**

Add to `run()`, after the avatar section:

```ts
  TOKEN_UID = 'ITEST_user_avatar';
  res = await fetch(`${base}/api/v1/users/profile`, {
    method: 'PATCH', headers: { ...AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName: 'Wanjiru', lastName: 'Kamau', region: 'Rift Valley', preferredLanguage: 'sw' }),
  });
  check('profile update returns 200', res.status === 200, `status=${res.status}`);
  res = await fetch(`${base}/api/v1/users/me`, { headers: AUTH });
  const me: any = await res.json();
  check('GET /users/me returns 200', res.status === 200, `status=${res.status}`);
  check('profile round-trips through Postgres', me.firstName === 'Wanjiru' && me.region === 'Rift Valley' && me.preferredLanguage === 'sw');
  check('/users/me includes the avatar', typeof me.avatarUrl === 'string');
```

Run the integration test. Expected: FAIL on `GET /users/me returns 200` (404).

- [ ] **Step 2: Add `getMe`**

In `user.controller.ts`, add:

```ts
export const getMe = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { prisma } = require('@farmassist/database');
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, lastName: true, phone: true, region: true, preferredLanguage: true, avatarUrl: true, createdAt: true },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.status(200).json(user);
};
```

In `user.routes.ts`, import `getMe` and add `router.get('/me', requireAuth, getMe);` above the `/profile` route. Run the integration test. Expected: all pass.

- [ ] **Step 3: Rewrite `Settings.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, LogOut, Plus } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useFarm } from "@/contexts/FarmContext";
import { apiClient } from "@/api/client";

const KENYA_REGIONS = [
  "Central Kenya", "Rift Valley", "Western Kenya",
  "Eastern Kenya", "Coast", "Nairobi", "Nyanza", "North Eastern",
];
const LANGUAGES = [{ value: "en", label: "English" }, { value: "sw", label: "Kiswahili" }];

export default function Settings() {
  const { user, logout } = useAuth();
  const { farms, setFarms, setActiveFarmId } = useFarm();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", region: "Central Kenya", preferredLanguage: "en", avatarUrl: "" });
  const [farmName, setFarmName] = useState("");
  const [farmLocation, setFarmLocation] = useState("");

  useEffect(() => {
    apiClient.get("/users/me")
      .then(({ data }) => setForm({
        firstName: data.firstName ?? "", lastName: data.lastName ?? "", phone: data.phone ?? "",
        region: data.region ?? "Central Kenya", preferredLanguage: data.preferredLanguage ?? "en",
        avatarUrl: data.avatarUrl ?? "",
      }))
      .catch(() => toast.error("Failed to load profile."))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { avatarUrl, ...profile } = form;
      await apiClient.patch("/users/profile", profile);
      i18n.changeLanguage(form.preferredLanguage);
      toast.success("Settings saved.");
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("File size must be less than 2MB");
    const body = new FormData();
    body.append("avatar", file);
    try {
      const { data } = await apiClient.post("/users/avatar", body, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({ ...f, avatarUrl: data.avatarUrl }));
      toast.success("Profile picture updated");
    } catch {
      toast.error("Failed to upload avatar");
    }
  };

  const createFarm = async () => {
    if (!farmName.trim()) return toast.error("Farm name is required");
    try {
      const { data } = await apiClient.post("/farms", { name: farmName, location: farmLocation });
      setFarms([...farms, { id: data.id, name: data.name, location: data.location }]);
      setActiveFarmId(data.id);
      setFarmName("");
      setFarmLocation("");
      toast.success("Farm created.");
    } catch {
      toast.error("Failed to create farm.");
    }
  };

  if (loading) {
    return <DashboardLayout><div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 p-4">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={form.avatarUrl} />
                <AvatarFallback>{(form.firstName[0] ?? user?.email?.[0] ?? "F").toUpperCase()}</AvatarFallback>
              </Avatar>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>Change photo</Button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Email</Label><Input value={user?.email ?? ""} disabled readOnly /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>First name</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
              <div className="space-y-2"><Label>Last name</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Region</Label>
                <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{KENYA_REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={form.preferredLanguage} onValueChange={(v) => setForm({ ...form, preferredLanguage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Save</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Farms</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <ul className="divide-y text-sm">
              {farms.map((f) => <li key={f.id} className="py-2">{f.name}{f.location ? ` · ${f.location}` : ""}</li>)}
            </ul>
            <div className="flex flex-col md:flex-row gap-2">
              <Input placeholder="Farm name" value={farmName} onChange={(e) => setFarmName(e.target.value)} />
              <Input placeholder="Location (optional)" value={farmLocation} onChange={(e) => setFarmLocation(e.target.value)} />
              <Button onClick={createFarm}><Plus className="w-4 h-4 mr-1" />Add farm</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent>
            <Button variant="outline" onClick={async () => { await logout(); navigate("/login"); }}>
              <LogOut className="w-4 h-4 mr-2" />Log out
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
```

The fake password, 2FA and account-deletion controls, the notification toggles, the units option and the billing upsell are gone. They only showed toasts, or belonged to removed features.

- [ ] **Step 4: Remove the Firestore read from `DashboardLayout.tsx`**

1. Delete the `firebase/firestore` and `@/lib/firebase` imports.
2. Delete `fetchFirestoreProfile` and its call.
3. In `fetchHeaderData`, after the display-name branch, add `if (data.user?.avatarUrl) setAvatarUrl(data.user.avatarUrl);`.

- [ ] **Step 5: Firebase client becomes Auth only**

Replace `apps/frontend/src/lib/firebase.ts` from `// Initialize Firebase` down with:

```ts
// Firebase is used for Auth only. Profile data lives in Postgres.
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
```

and delete the `firebase/firestore` and `firebase/storage` imports at the top.

- [ ] **Step 6: Consent line on SignUp**

In `apps/frontend/src/features/auth/SignUp.tsx`, directly above the submit `<Button` (around line 288), add:

```tsx
            <p className="text-xs text-gray-500">
              By creating an account you agree that photos you scan are stored and used to improve FarmAssist's crop diagnosis.
            </p>
```

- [ ] **Step 7: Build, lint, test**

```bash
npm run build --workspace=vite_react_shadcn_ts
npm run lint --workspace=vite_react_shadcn_ts 2>&1 | tail -5
DATABASE_URL='...' npm run test:integration --workspace=backend
grep -rn "firebase/firestore\|firebase/storage\|\bdb\b.*@/lib/firebase" apps/frontend/src || echo "no firestore in frontend"
```
Expected: the build succeeds, lint shows no new errors compared with the Task 1 baseline, every integration check passes, and the grep prints `no firestore in frontend`.

- [ ] **Step 8: Manual check**

1. Log in as an existing user whose name and avatar were previously saved only in Firestore. The header shows the Prisma `firstName`, or else the Firebase display name, or else the email. The avatar shows if `User.avatarUrl` is set.
2. Change your name and region in Settings and save. Reload the page and confirm they persisted.
3. Create a farm. It appears in the header's farm switcher.

- [ ] **Step 9: Commit**

```bash
git add -A apps/frontend apps/backend
git commit -m "refactor: make Postgres the only profile store; add scan consent line"
```

---

### Task 8: Remove Firestore from the backend and repo

**Files:**
- Modify: `packages/firebase-admin/index.ts`
- Delete: `firestore.rules`, `firestore.indexes.json`, `scripts/seed-diseases.ts`, `tests/test-prisma.ts`
- Modify: `firebase.json`

- [ ] **Step 1: Confirm nothing uses `dbAdmin`**

Run: `grep -rn "dbAdmin\|firestore()" apps packages scripts tests --include=*.ts | grep -v node_modules`
Expected: only `packages/firebase-admin/index.ts`.

- [ ] **Step 2: Auth-only admin package**

In `packages/firebase-admin/index.ts`, delete `export const dbAdmin = admin.firestore();`, and change the error message `Firestore Admin will fail.` to `Auth token verification will fail.`.

- [ ] **Step 3: Delete the Firestore files**

```bash
git rm firestore.rules firestore.indexes.json scripts/seed-diseases.ts tests/test-prisma.ts
```

In `firebase.json`, delete the `"firestore": { ... }` block and the comma before it, so that only `"hosting"` remains.

- [ ] **Step 4: Typecheck and test**

```bash
(cd apps/backend && npx tsc --noEmit)
DATABASE_URL='...' npm run test:integration --workspace=backend
```
Expected: clean, all pass.

- [ ] **Step 5: Commit**

```bash
git add -A packages/firebase-admin firebase.json firestore.rules firestore.indexes.json scripts tests
git commit -m "chore: remove Firestore; Firebase is Auth only"
```

---

### Task 9: Prune unused UI components and dependencies, then verify

**Files:**
- Delete: unused files under `apps/frontend/src/components/ui/`
- Modify: `apps/frontend/package.json`, `apps/backend/package.json`, `package-lock.json`

- [ ] **Step 1: List the shadcn components nothing imports**

```bash
cd apps/frontend/src
for f in components/ui/*.tsx; do
  n=$(basename "$f" .tsx)
  grep -rqE "components/ui/$n[\"']" --include=*.ts --include=*.tsx . --exclude-dir=node_modules || echo "$f"
done
```

Run it again after each deletion until it prints nothing, because components import each other: `sidebar` imports `sheet`, for example. Delete the listed files with `git rm`. Keep `toaster.tsx`, `sonner.tsx` and `tooltip.tsx`, since `App.tsx` uses them.

- [ ] **Step 2: Remove npm dependencies nothing imports**

For each dependency in `apps/frontend/package.json`, run:
```bash
grep -rq "from ['\"]<name>" apps/frontend/src || echo "<name> unused"
```
Do not remove build tooling (`vite`, `@vitejs/*`, `tailwindcss*`, `postcss`, `autoprefixer`, `eslint*`, `typescript*`, `lovable-tagger`, `@types/*`). Expect `firebase` to stay (Auth); the Radix packages behind deleted `ui/*` files, `react-leaflet`/`leaflet` if `Map.tsx` is unused, and `date-fns` if nothing imports it any more should go. Uninstall with `npm uninstall <names> --workspace=vite_react_shadcn_ts`.

In `apps/backend/package.json`, remove `bullmq` if `grep -rn "bullmq" apps/backend/src` shows only the WhatsApp channel. **Keep it if the inbound queue uses it**, which it does today (`inbound.queue.ts`, `inbound.worker.ts`). Also remove `redis` if `grep -rn "from 'redis'" apps packages` is empty (`ioredis` is the client that's actually used).

- [ ] **Step 3: Final verification**

```bash
npm run build --workspace=vite_react_shadcn_ts
(cd apps/backend && npx tsc --noEmit)
npm run test:ai --workspace=backend
npm run test:whatsapp --workspace=backend
DATABASE_URL='...' npm run test:integration --workspace=backend
grep -rnE "firestore|dbAdmin|aiQueue|/crops|/notifications|/products|/agrovets|/tasks|/farm-notes|/iot|/diseases" apps/backend/src apps/frontend/src packages --include=*.ts --include=*.tsx | grep -v node_modules || echo "clean"
```
Expected: everything passes, and the grep prints `clean`. If the WhatsApp inbound test needs env vars, run it the way its header comment describes.

- [ ] **Step 4: Manual end-to-end (spec §7)**

1. Sign up as a new user. The consent line is visible.
2. Log in. The dashboard home shows weather, Farms 1, Scans 0.
3. Run a scan and confirm it ("Yes"). Back on the dashboard, Scans shows 1 and the scan is listed.
4. Change profile settings, then reload the page. The changes persisted.
5. Create a second farm and switch to it. Scans for that farm shows 0.
6. Visit `/shop`. You get the NotFound page.

- [ ] **Step 5: Commit and open the PR**

```bash
git add -A
git commit -m "chore(frontend): prune unused UI components and dependencies"
git push -u origin feat/strip-to-core
gh pr create --base main --title "Strip to core: server-side diagnosis with training capture" --body "Implements docs/superpowers/specs/2026-10-06-strip-to-core-design.md. See docs/superpowers/plans/2026-10-06-strip-to-core.md for the task list and verification."
```
