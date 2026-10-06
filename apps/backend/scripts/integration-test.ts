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
const sharp = require('sharp');
const app = require('../src/app').default;

const AUTH = { Authorization: 'Bearer stub' };
const UIDS = [
  'ITEST_user_provisioning',
  'ITEST_user_race',
  'ITEST_user_avatar',
  'ITEST_user_outsider',
];
const AVATARS_DIR = path.join(__dirname, '../public/avatars');

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
  // Provisioned tenants get random uuids, so they are only reachable through
  // the membership rows of the test users.
  const memberships = await prisma.tenantUser.findMany({ where: { userId: { in: UIDS } } });
  const tenantIds = [...new Set(memberships.map((m: { tenantId: string }) => m.tenantId))] as string[];
  if (tenantIds.length) await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: UIDS } } });
  for (const uid of UIDS) {
    const f = path.join(AVATARS_DIR, `${uid}.webp`);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

async function run(base: string) {
  await cleanup();

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
    body: JSON.stringify({ diseaseName: 'ITEST intrusion', farmId: victimFarm.id }),
  });
  check("outsider cannot attach a scan to someone else's farm", res.status === 403, `status=${res.status}`);

  const intruded = await prisma.scan.count({ where: { farmId: victimFarm.id, userId: 'ITEST_user_outsider' } });
  check('no intruding row reached the database', intruded === 0, `count=${intruded}`);
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
