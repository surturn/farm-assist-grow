import { prisma } from '@farmassist/database';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

/**
 * The phone-number side of identity: a FarmerChannel exists from the farmer's
 * first WhatsApp message, before any account does, and is bound to a User only
 * when they finish signing up on the website.
 */

const LINK_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PIN_KEY_LENGTH = 64;

/**
 * Meta sends numbers without a leading plus and without punctuation. Storing
 * one canonical form is what makes `phone` a usable unique key.
 */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) throw new Error('Phone number contains no digits');
  return `+${digits}`;
}

export async function hashPin(pin: string): Promise<string> {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be exactly four digits');
  const salt = randomBytes(16);
  const derived = await scrypt(pin, salt, PIN_KEY_LENGTH);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

export async function verifyPin(pin: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [saltHex, expectedHex] = stored.split(':');
  if (!saltHex || !expectedHex) return false;
  const derived = await scrypt(pin, Buffer.from(saltHex, 'hex'), PIN_KEY_LENGTH);
  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

export async function findChannelByPhone(phone: string) {
  return prisma.farmerChannel.findUnique({
    where: { phone: normalisePhone(phone) },
    include: { user: true },
  });
}

/**
 * Called on every inbound message. Creates the channel on first contact and
 * always advances lastInboundAt, which is what reopens the 24-hour window the
 * sender enforces.
 */
export async function touchChannel(phone: string, language?: string) {
  const normalised = normalisePhone(phone);
  return prisma.farmerChannel.upsert({
    where: { phone: normalised },
    create: {
      phone: normalised,
      lastInboundAt: new Date(),
      ...(language ? { language } : {}),
    },
    update: {
      lastInboundAt: new Date(),
      // An inbound message is an implicit opt back in.
      optedOut: false,
    },
    include: { user: true },
  });
}

/** True while Meta still permits free-form (non-template) messages to this number. */
export function isServiceWindowOpen(lastInboundAt: Date | null | undefined): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - lastInboundAt.getTime() < 24 * 60 * 60 * 1000;
}

export async function issueLinkToken(channelId: string) {
  const linkToken = randomBytes(16).toString('hex');
  return prisma.farmerChannel.update({
    where: { id: channelId },
    data: {
      linkToken,
      linkTokenExpiresAt: new Date(Date.now() + LINK_TOKEN_TTL_MS),
    },
  });
}

export async function findChannelByLinkToken(linkToken: string) {
  const channel = await prisma.farmerChannel.findUnique({ where: { linkToken } });
  if (!channel) return null;
  if (channel.linkTokenExpiresAt && channel.linkTokenExpiresAt.getTime() < Date.now()) return null;
  return channel;
}

/**
 * Binds a channel to a newly created account and burns the token. The caller
 * is responsible for backfilling provisional records afterwards.
 */
export async function linkChannelToUser(channelId: string, userId: string, pin?: string) {
  return prisma.farmerChannel.update({
    where: { id: channelId },
    data: {
      userId,
      linkToken: null,
      linkTokenExpiresAt: null,
      ...(pin ? { pinHash: await hashPin(pin) } : {}),
    },
  });
}

export async function setLanguage(channelId: string, language: string) {
  return prisma.farmerChannel.update({ where: { id: channelId }, data: { language } });
}

/** SIMAMA / STOP. Honoured before any send, so it must never fail silently. */
export async function optOut(channelId: string) {
  return prisma.farmerChannel.update({ where: { id: channelId }, data: { optedOut: true } });
}
