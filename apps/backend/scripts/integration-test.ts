/**
 * Integration tests: exercise the real Express app against a real Postgres.
 *
 * Run against the docker compose stack:
 *   DATABASE_URL='postgresql://<user>:<pass>@localhost:5432/farmassist' npm run test:integration
 *
 * Firebase token verification is stubbed, because these tests are about our
 * own persistence and routing, not about Google's signature checking. Every
 * row the tests create is namespaced with the ITEST_ prefix and deleted at the
 * end, so this is safe to run against a development database that already has
 * real accounts in it.
 */
import { generateKeyPairSync } from 'crypto';
import fs from 'fs';
import path from 'path';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Point it at the running Postgres container.');
  process.exit(1);
}

// firebase-admin parses FIREBASE_PRIVATE_KEY as PEM at import time, so it needs
// a syntactically valid key even though verifyIdToken is stubbed below and this
// key never signs anything.
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'integration-test';
process.env.FIREBASE_PROJECT_ID = 'integration-test';
process.env.FIREBASE_CLIENT_EMAIL = 'integration-test@example.com';
process.env.FIREBASE_PRIVATE_KEY = privateKey;
process.env.NODE_ENV = 'development';

const { authAdmin } = require('@farmassist/firebase-admin');
let TOKEN_UID = '';
authAdmin.verifyIdToken = async () => ({
  uid: TOKEN_UID,
  email: `${TOKEN_UID}@itest.local`,
  name: 'Test Farmer',
  phone_number: '+254700000000',
});

const { prisma } = require('@farmassist/database');
const { redis } = require('@farmassist/redis');
const sharp = require('sharp');
const app = require('../src/app').default;

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

const AUTH = { Authorization: 'Bearer stub' };
const UIDS = [
  'ITEST_user_provisioning',
  'ITEST_user_race',
  'ITEST_user_avatar',
  'ITEST_user_outsider',
  'ITEST_user_scan',
];
const AVATARS_DIR = path.join(__dirname, '../public/avatars');
const SCAN_DIR = path.join(__dirname, '../data/scans');

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name} ${detail}`);
  }
}

async function cleanup() {
  // Rate-limit counters outlive a run (1h window), so repeated runs would
  // start hitting 429s. Clear the test users' counters.
  // The client connects lazily; give it up to 2s, then skip if Redis is down
  // (the rate limiter fails open in that case anyway).
  for (let i = 0; i < 20 && !['ready', 'end'].includes(redis.status); i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (redis.status === 'ready') {
    const keys: string[] = await redis.keys('rate-limit:*:ITEST_*');
    if (keys.length) await redis.del(...keys);
  }
  // Provisioned tenants get random uuids, so they are only reachable through
  // the membership rows of the test users.
  const memberships = await prisma.tenantUser.findMany({ where: { userId: { in: UIDS } } });
  const tenantIds = [...new Set(memberships.map((m: { tenantId: string }) => m.tenantId))] as string[];
  if (tenantIds.length) await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  const scans = await prisma.scan.findMany({ where: { userId: { in: UIDS } }, select: { imageUrl: true } });
  for (const s of scans) if (s.imageUrl) fs.rmSync(path.join(SCAN_DIR, path.basename(s.imageUrl)), { force: true });
  await prisma.user.deleteMany({ where: { id: { in: UIDS } } });
  for (const uid of UIDS) {
    const f = path.join(AVATARS_DIR, `${uid}.webp`);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

async function run(base: string) {
  await cleanup();

  const scanPng = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#2e7d32' } }).png().toBuffer();
  const imageBase64 = `data:image/png;base64,${scanPng.toString('base64')}`;
  const jsonAuth = { ...AUTH, 'Content-Type': 'application/json' };

  // --- First login provisions a user, tenant, membership and farm together.
  TOKEN_UID = 'ITEST_user_provisioning';
  let res = await fetch(`${base}/api/v1/dashboard`, { headers: AUTH });
  check('first login is authenticated', res.status === 200, `status=${res.status}`);

  const user = await prisma.user.findUnique({ where: { id: TOKEN_UID } });
  check('user row created', !!user);
  const memberships = await prisma.tenantUser.findMany({ where: { userId: TOKEN_UID } });
  check('tenant membership created', memberships.length === 1, `count=${memberships.length}`);
  check('membership role is OWNER', memberships[0]?.role === 'OWNER', `role=${memberships[0]?.role}`);
  const farms = memberships.length
    ? await prisma.farm.findMany({ where: { tenantId: memberships[0].tenantId } })
    : [];
  check('default farm created in the same transaction', farms.length === 1, `count=${farms.length}`);

  // --- Concurrent first logins race on the unique user id. The P2002 branch
  // must treat the loser as a success rather than a 500.
  TOKEN_UID = 'ITEST_user_race';
  const raced = await Promise.all(
    Array.from({ length: 5 }, () => fetch(`${base}/api/v1/dashboard`, { headers: AUTH }))
  );
  const statuses = raced.map((r) => r.status);
  check('all concurrent first logins succeed', statuses.every((s) => s === 200), `statuses=${statuses}`);
  check('exactly one user row after the race', (await prisma.user.count({ where: { id: TOKEN_UID } })) === 1);
  check(
    'exactly one membership after the race',
    (await prisma.tenantUser.count({ where: { userId: TOKEN_UID } })) === 1
  );

  // --- Dashboard returns only the core fields.
  res = await fetch(`${base}/api/v1/dashboard`, { headers: AUTH });
  const dash: any = await res.json();
  check('GET /dashboard returns 200', res.status === 200, `status=${res.status}`);
  check('dashboard lists the default farm', Array.isArray(dash.farms) && dash.farms.length === 1);
  check('dashboard has no removed fields', !('alerts' in dash) && !('news' in dash) && !('stats' in dash));

  res = await fetch(`${base}/api/v1/dashboard`);
  check('dashboard rejects an unauthenticated caller', res.status === 401, `status=${res.status}`);

  for (const gone of ['agrovets', 'tasks', 'farm-notes', 'notifications', 'products', 'diseases', 'iot/telemetry']) {
    res = await fetch(`${base}/api/v1/${gone}`, { headers: AUTH });
    check(`/${gone} is gone`, res.status === 404, `status=${res.status}`);
  }

  // --- Avatar upload writes under the verified uid, ignoring the request body.
  TOKEN_UID = 'ITEST_user_avatar';
  await fetch(`${base}/api/v1/dashboard`, { headers: AUTH }); // provision the user
  const png = await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 20, g: 120, b: 40 } },
  })
    .png()
    .toBuffer();

  const form = new FormData();
  form.append('avatar', new Blob([png], { type: 'image/png' }), 'a.png');
  // A body uid is what the old code trusted; it must now be ignored entirely.
  form.append('uid', '../../../../ITEST_escaped');

  res = await fetch(`${base}/api/v1/users/avatar`, { method: 'POST', headers: AUTH, body: form });
  const body = await res.json();
  check('avatar upload returns 200', res.status === 200, `status=${res.status} body=${JSON.stringify(body)}`);
  check('avatar is stored under the token uid', fs.existsSync(path.join(AVATARS_DIR, `${TOKEN_UID}.webp`)));
  check(
    'body-supplied uid cannot traverse out of the avatars directory',
    !fs.existsSync(path.join(AVATARS_DIR, '../../../../ITEST_escaped.webp'))
  );
  check('avatar url is persisted on the user', typeof body?.avatarUrl === 'string' && body.avatarUrl.includes(TOKEN_UID));
  const avatarUser = await prisma.user.findUnique({ where: { id: TOKEN_UID } });
  check('avatarUrl column round-trips', !!avatarUser?.avatarUrl);

  res = await fetch(`${base}/api/v1/users/avatar`, { method: 'POST', body: form });
  check('avatar upload rejects an unauthenticated caller', res.status === 401, `status=${res.status}`);

  // --- Profile has one source of truth: Postgres.
  TOKEN_UID = 'ITEST_user_avatar';
  res = await fetch(`${base}/api/v1/users/profile`, {
    method: 'PATCH', headers: { ...AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName: 'Wanjiru', lastName: 'Kamau', region: 'Rift Valley', preferredLanguage: 'sw' }),
  });
  check('profile update returns 200', res.status === 200, `status=${res.status}`);
  res = await fetch(`${base}/api/v1/users/me`, { headers: AUTH });
  const me: any = await res.json().catch(() => ({}));
  check('GET /users/me returns 200', res.status === 200, `status=${res.status}`);
  check('profile round-trips through Postgres', me.firstName === 'Wanjiru' && me.region === 'Rift Valley' && me.preferredLanguage === 'sw');
  check('/users/me includes the avatar', typeof me.avatarUrl === 'string');

  // --- A farm id in the request body must be checked against membership.
  // The first test user owns a farm; a second, unrelated user must not be
  // able to attach anything to it just by naming its id.
  const ownerMemberships = await prisma.tenantUser.findMany({
    where: { userId: 'ITEST_user_provisioning' },
  });
  const victimFarm = await prisma.farm.findFirst({
    where: { tenantId: ownerMemberships[0].tenantId },
  });

  TOKEN_UID = 'ITEST_user_outsider';
  await fetch(`${base}/api/v1/dashboard`, { headers: AUTH }); // provision the outsider

  const asOutsider = { ...AUTH, 'Content-Type': 'application/json' };

  res = await fetch(`${base}/api/v1/scans`, {
    method: 'POST',
    headers: asOutsider,
    body: JSON.stringify({ imageBase64, farmId: victimFarm.id }),
  });
  check("outsider cannot attach a scan to someone else's farm", res.status === 403, `status=${res.status}`);

  const intruded = await prisma.scan.count({ where: { farmId: victimFarm.id, userId: 'ITEST_user_outsider' } });
  check('no intruding row reached the database', intruded === 0, `count=${intruded}`);

  // --- Server-side diagnosis captures a training example.
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
}

const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    await run(base);
  } catch (error: any) {
    failed++;
    console.log('ERROR', error?.stack || error);
  } finally {
    await cleanup();
    check('cleanup removed every test user', (await prisma.user.count({ where: { id: { in: UIDS } } })) === 0);
    console.log(`\n${passed} passed, ${failed} failed`);
    server.close();
    await prisma.$disconnect();
    process.exit(failed ? 1 : 0);
  }
});
