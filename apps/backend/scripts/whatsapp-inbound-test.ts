/**
 * Integration tests for the WhatsApp inbound pipeline (Milestone 2).
 *
 *   DATABASE_URL='postgresql://<user>:<pass>@localhost:5432/farmassist' \
 *     npm run test:whatsapp
 *
 * Exercises the real Express app, the real signature check, the real BullMQ
 * queue and the real worker handler against Postgres and Redis. Every channel
 * it creates uses a +254700000-9xx number and is deleted at the end.
 */
import { generateKeyPairSync, createHmac } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Point it at the running Postgres container.');
  process.exit(1);
}

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

// Test-only WhatsApp credentials. The real ones are never needed here: the
// signature check verifies against whatever secret is configured, so a
// throwaway secret proves the mechanism just as well.
const APP_SECRET = 'test-app-secret-not-a-real-one';
const VERIFY_TOKEN = 'test-verify-token';
process.env.WHATSAPP_APP_SECRET = APP_SECRET;
process.env.WHATSAPP_VERIFY_TOKEN = VERIFY_TOKEN;
process.env.WHATSAPP_PHONE_NUMBER_ID = '1216085321597290';
process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';

const { prisma } = require('@farmassist/database');
const app = require('../src/app').default;
const { routeIntent } = require('../src/channels/whatsapp/intent.router');
const { handleInboundJob } = require('../src/channels/whatsapp/inbound.worker');
const { inboundQueue } = require('../src/channels/whatsapp/inbound.queue');

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

// Test numbers, all inside a range no real farmer will hold.
const PHONE_TEXT = '254700000901';
const PHONE_STOP = '254700000902';
const PHONE_IDEMPOTENT = '254700000903';
const PHONE_IMAGE = '254700000904';
const PHONES = [PHONE_TEXT, PHONE_STOP, PHONE_IDEMPOTENT, PHONE_IMAGE];
const JOB_IDS: string[] = [];

function messagePayload(from: string, id: string, message: Record<string, unknown>) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry-1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15556658676', phone_number_id: '1216085321597290' },
              contacts: [{ profile: { name: 'Test Farmer' }, wa_id: from }],
              messages: [{ from, id, timestamp: '1756400000', ...message }],
            },
          },
        ],
      },
    ],
  };
}

function sign(body: string, secret = APP_SECRET) {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

async function post(base: string, payload: unknown, signature?: string) {
  const body = JSON.stringify(payload);
  return fetch(`${base}/api/v1/channels/whatsapp/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(signature ? { 'X-Hub-Signature-256': signature } : {}),
    },
    body,
  });
}

async function cleanup() {
  await prisma.farmerChannel.deleteMany({
    where: { phone: { in: PHONES.map((p) => `+${p}`) } },
  });
  for (const id of JOB_IDS) {
    const job = await inboundQueue.getJob(id);
    if (job) await job.remove().catch(() => {});
  }
}

async function run(base: string) {
  await cleanup();

  // --- Meta's verification handshake
  let res = await fetch(
    `${base}/api/v1/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=challenge-123`
  );
  check('handshake echoes the challenge', res.status === 200 && (await res.text()) === 'challenge-123');

  res = await fetch(
    `${base}/api/v1/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=nope`
  );
  check('handshake with a wrong token is 403', res.status === 403, `status=${res.status}`);

  // --- Signature verification is the security boundary
  const payload = messagePayload(PHONE_TEXT, 'wamid.TEST_TEXT_1', {
    type: 'text',
    text: { body: 'Mahindi yangu yana ugonjwa' },
  });
  const body = JSON.stringify(payload);

  res = await post(base, payload);
  check('unsigned webhook is rejected', res.status === 401, `status=${res.status}`);

  res = await post(base, payload, sign(body, 'the-wrong-secret'));
  check('webhook signed with the wrong secret is rejected', res.status === 401, `status=${res.status}`);

  res = await post(base, payload, 'sha256=not-hex');
  check('malformed signature is rejected', res.status === 401, `status=${res.status}`);

  res = await post(base, payload, sign(body).replace('sha256=', 'sha1='));
  check('non-sha256 signature scheme is rejected', res.status === 401, `status=${res.status}`);

  // Nothing above should have reached the queue or the database.
  const leakedChannel = await prisma.farmerChannel.findUnique({ where: { phone: `+${PHONE_TEXT}` } });
  check('a rejected webhook writes nothing', leakedChannel === null);

  // --- A correctly signed delivery is accepted and queued
  res = await post(base, payload, sign(body));
  check('correctly signed webhook returns 200', res.status === 200, `status=${res.status}`);

  JOB_IDS.push('msg-wamid.TEST_TEXT_1');
  const queued = await inboundQueue.getJob('msg-wamid.TEST_TEXT_1');
  check('message was enqueued under its Meta message id', queued !== undefined && queued !== null);

  // --- The worker: run the handler directly so the assertions are not racing
  // a background consumer.
  await handleInboundJob({
    kind: 'message',
    phoneNumberId: '1216085321597290',
    message: { from: PHONE_TEXT, id: 'wamid.TEST_TEXT_1', timestamp: '1756400000', type: 'text', text: { body: 'Mahindi yangu yana ugonjwa' } },
    receivedAt: new Date().toISOString(),
  });

  const channel = await prisma.farmerChannel.findUnique({ where: { phone: `+${PHONE_TEXT}` } });
  check('worker creates the channel on first contact', !!channel);
  check('phone is normalised to E.164', channel?.phone === `+${PHONE_TEXT}`);
  check('lastInboundAt is set, opening the service window', !!channel?.lastInboundAt);
  check('a new channel is not opted out', channel?.optedOut === false);

  const events = await prisma.channelEvent.findMany({ where: { channelId: channel.id } });
  check('one ChannelEvent recorded', events.length === 1, `count=${events.length}`);
  check('event is inbound text', events[0]?.direction === 'INBOUND' && events[0]?.type === 'message.text');
  check('event carries the Meta message id', events[0]?.waMessageId === 'wamid.TEST_TEXT_1');

  // --- Idempotency: Meta retries, we must not act twice
  const dupe = {
    kind: 'message' as const,
    phoneNumberId: '1216085321597290',
    message: { from: PHONE_IDEMPOTENT, id: 'wamid.TEST_DUPE', timestamp: '1756400000', type: 'text' as const, text: { body: 'habari' } },
    receivedAt: new Date().toISOString(),
  };
  await handleInboundJob(dupe);
  await handleInboundJob(dupe);
  const dupeChannel = await prisma.farmerChannel.findUnique({ where: { phone: `+${PHONE_IDEMPOTENT}` } });
  const dupeEvents = await prisma.channelEvent.count({ where: { channelId: dupeChannel.id } });
  check('a replayed message produces exactly one event', dupeEvents === 1, `count=${dupeEvents}`);

  // --- Opt-out, and the consent rule that an unrelated message must not undo it
  await handleInboundJob({
    kind: 'message',
    phoneNumberId: '1216085321597290',
    message: { from: PHONE_STOP, id: 'wamid.TEST_STOP', timestamp: '1756400000', type: 'text', text: { body: '  SIMAMA ' } },
    receivedAt: new Date().toISOString(),
  });
  let stopChannel = await prisma.farmerChannel.findUnique({ where: { phone: `+${PHONE_STOP}` } });
  check('SIMAMA opts the farmer out', stopChannel?.optedOut === true);

  await handleInboundJob({
    kind: 'message',
    phoneNumberId: '1216085321597290',
    message: { from: PHONE_STOP, id: 'wamid.TEST_AFTER_STOP', timestamp: '1756400000', type: 'text', text: { body: 'mahindi' } },
    receivedAt: new Date().toISOString(),
  });
  stopChannel = await prisma.farmerChannel.findUnique({ where: { phone: `+${PHONE_STOP}` } });
  check('an unrelated message does not undo the opt-out', stopChannel?.optedOut === true);

  await handleInboundJob({
    kind: 'message',
    phoneNumberId: '1216085321597290',
    message: { from: PHONE_STOP, id: 'wamid.TEST_START', timestamp: '1756400000', type: 'text', text: { body: 'ANZA' } },
    receivedAt: new Date().toISOString(),
  });
  stopChannel = await prisma.farmerChannel.findUnique({ where: { phone: `+${PHONE_STOP}` } });
  check('ANZA opts the farmer back in', stopChannel?.optedOut === false);

  // --- An image is recorded with its media id, ready for Milestone 4
  await handleInboundJob({
    kind: 'message',
    phoneNumberId: '1216085321597290',
    message: {
      from: PHONE_IMAGE,
      id: 'wamid.TEST_IMAGE',
      timestamp: '1756400000',
      type: 'image',
      image: { id: 'media-abc-123', mime_type: 'image/jpeg', caption: 'majani' },
    },
    receivedAt: new Date().toISOString(),
  });
  const imageChannel = await prisma.farmerChannel.findUnique({ where: { phone: `+${PHONE_IMAGE}` } });
  const imageEvent = await prisma.channelEvent.findFirst({ where: { channelId: imageChannel.id } });
  check('image is recorded as message.image', imageEvent?.type === 'message.image');
  check('media id is captured for the media downloader', (imageEvent?.metadata as any)?.mediaId === 'media-abc-123');

  // --- Intent router, against the shapes Meta actually sends
  const cases: Array<[string, any, string]> = [
    ['text', { type: 'text', text: { body: 'mahindi yangu' } }, 'message.text'],
    ['SIMAMA', { type: 'text', text: { body: 'SIMAMA' } }, 'command.stop'],
    ['stop lowercase', { type: 'text', text: { body: 'stop' } }, 'command.stop'],
    ['ANZA', { type: 'text', text: { body: 'anza' } }, 'command.start'],
    ['LUGHA', { type: 'text', text: { body: 'LUGHA' } }, 'command.language'],
    ['MSAADA', { type: 'text', text: { body: 'msaada' } }, 'command.help'],
    ['image', { type: 'image', image: { id: 'm1', mime_type: 'image/jpeg' } }, 'message.image'],
    ['voice note', { type: 'audio', audio: { id: 'a1', mime_type: 'audio/ogg', voice: true } }, 'message.audio'],
    ['video', { type: 'video', video: { id: 'v1', mime_type: 'video/mp4' } }, 'message.unsupported'],
    ['location', { type: 'location' }, 'message.unsupported'],
  ];
  for (const [label, message, expected] of cases) {
    const intent = routeIntent({ from: '254700000999', id: 'x', timestamp: '1', ...message });
    check(`intent: ${label} -> ${expected}`, intent.kind === expected, `got=${intent.kind}`);
  }

  const sw = routeIntent({ from: 'x', id: 'x', timestamp: '1', type: 'text', text: { body: 'LUGHA English' } });
  check('intent: "LUGHA English" selects en', sw.kind === 'command.language' && sw.language === 'en', `got=${JSON.stringify(sw)}`);

  const notCommand = routeIntent({ from: 'x', id: 'x', timestamp: '1', type: 'text', text: { body: 'nimepanda mahindi leo asubuhi' } });
  check('a sentence is not mistaken for a command', notCommand.kind === 'message.text');

  // --- A status callback must not invent a channel
  await handleInboundJob({
    kind: 'status',
    phoneNumberId: '1216085321597290',
    status: { id: 'wamid.OUT_1', status: 'delivered', timestamp: '1756400000', recipient_id: '254700000999' },
    receivedAt: new Date().toISOString(),
  });
  const invented = await prisma.farmerChannel.findUnique({ where: { phone: '+254700000999' } });
  check('a status for an unknown number creates no channel', invented === null);
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
    const left = await prisma.farmerChannel.count({ where: { phone: { in: PHONES.map((p) => `+${p}`) } } });
    check('cleanup removed every test channel', left === 0, `left=${left}`);
    console.log(`\n${passed} passed, ${failed} failed`);
    server.close();
    await inboundQueue.close();
    await prisma.$disconnect();
    process.exit(failed ? 1 : 0);
  }
});
