import { client } from '@/database/client';
import logger from '@/utils/logger';

/**
 * The one row counting wrong scanner PINs from every address together
 *
 * Kept in the same auth_rate_limits table as better-auth's own counts, under a
 * key better-auth never makes (its keys are an address plus a path), so the
 * same nightly prune clears it.
 */
const KEY = 'global:/warehouse/sign-in:pin-failures';

/** Wrong PINs, from all addresses together, before PIN sign-in closes */
export const GLOBAL_PIN_FAILURES = 30;

/** How long the count runs, and how long PIN sign-in stays closed once it is reached */
export const GLOBAL_PIN_WINDOW_SECONDS = 60 * 60;

const windowMs = GLOBAL_PIN_WINDOW_SECONDS * 1000;

/**
 * Whether PIN sign-in is closed because too many wrong PINs came in this hour
 *
 * The per-address limit (10 in 15 minutes) does nothing against someone who
 * spreads guesses over many addresses, and a six-digit PIN has only a million
 * values. This caps guesses across everyone. The device token is not checked
 * here, so a scanner holding its device cookie still signs in while PINs are
 * closed.
 *
 * If the table cannot be read, PIN sign-in stays open and the failure is
 * logged: a missing table must not lock the warehouse out.
 *
 * @returns Seconds until PINs are accepted again, or null when they are accepted now
 */
export const pinSignInClosedFor = async () => {
  try {
    const [row] = await client<{ count: number; windowStart: number }[]>`
      SELECT count, last_request::float8 AS "windowStart" FROM auth_rate_limits WHERE key = ${KEY}
    `;
    if (!row || row.count < GLOBAL_PIN_FAILURES) return null;
    const left = row.windowStart + windowMs - Date.now();
    return left > 0 ? Math.ceil(left / 1000) : null;
  } catch (error) {
    logger.error('[Warehouse sign-in] Could not read the PIN failure count; PIN sign-in left open', { error });
    return null;
  }
};

/**
 * Count one wrong PIN towards the hourly total
 *
 * The window is fixed from the first failure (last_request holds its start and
 * is not moved by later failures), so PIN sign-in reopens an hour after the
 * guessing began rather than an hour after it stopped.
 *
 * @returns The count after this failure, or null if it could not be stored
 */
export const recordPinFailure = async () => {
  const now = Date.now();
  try {
    const [row] = await client<{ count: number }[]>`
      INSERT INTO auth_rate_limits AS r (key, count, last_request) VALUES (${KEY}, 1, ${now})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN ${now} - r.last_request > ${windowMs} THEN 1 ELSE r.count + 1 END,
        last_request = CASE WHEN ${now} - r.last_request > ${windowMs} THEN ${now} ELSE r.last_request END
      RETURNING count
    `;
    return row?.count ?? null;
  } catch (error) {
    logger.error('[Warehouse sign-in] Could not count a wrong PIN', { error });
    return null;
  }
};
