import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { settings } from '@/database/schema';

const scryptAsync = promisify(scrypt) as (password: string, salt: string, keylen: number) => Promise<Buffer>;

/** The settings key holding the hashed scanner PIN: never the PIN itself */
export const SCANNER_PIN_SETTING = 'wms.scanner_pin';

/** Six digits: quick to type on a scanner, and wrong guesses are rate-limited */
export const SCANNER_PIN_PATTERN = /^\d{6}$/;

/**
 * Hash a scanner PIN for the settings table
 *
 * @param pin - Six digits
 * @returns `salt:hash`, both hex
 */
export const hashScannerPin = async (pin: string) => {
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(pin, salt, 32);
  return `${salt}:${hash.toString('hex')}`;
};

/**
 * Whether a PIN typed on a scanner matches the one staff set
 *
 * False when no PIN has been set, so the sign-in is closed until someone sets one.
 *
 * @param pin - What was typed
 * @returns True on a match
 */
export const checkScannerPin = async (pin: string) => {
  if (!SCANNER_PIN_PATTERN.test(pin)) return false;
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, SCANNER_PIN_SETTING))
    .limit(1);
  const [salt, stored] = row?.value.split(':') ?? [];
  if (!salt || !stored) return false;
  const hash = await scryptAsync(pin, salt, 32);
  const expected = Buffer.from(stored, 'hex');
  return expected.length === hash.length && timingSafeEqual(expected, hash);
};

/**
 * Whether a scanner PIN has been set
 *
 * @returns True when the settings row exists
 */
export const hasScannerPin = async () => {
  const [row] = await db
    .select({ key: settings.key })
    .from(settings)
    .where(eq(settings.key, SCANNER_PIN_SETTING))
    .limit(1);
  return Boolean(row);
};
