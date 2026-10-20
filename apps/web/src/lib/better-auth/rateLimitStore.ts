import { client } from '@/database/client';
import logger from '@/utils/logger';

interface Row {
  key: string;
  count: number;
  lastRequest: number;
}

/** Rows idle for longer than this are pruned now and then */
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;

const prune = () => {
  if (Math.random() > 0.01) return;
  void client`DELETE FROM auth_rate_limits WHERE last_request < ${Date.now() - PRUNE_AFTER_MS}`.catch((error) =>
    logger.warn('[Better Auth] Could not prune rate-limit rows', { error }),
  );
};

/**
 * Rate-limit counts kept in Postgres, shared by every server
 *
 * better-auth keeps its counts in each server's memory by default. On Vercel
 * many servers answer requests, so "10 sign-in emails per 5 minutes" held per
 * server rather than per person, and could be multiplied by however many were
 * running. Here every server reads and writes the same row.
 *
 * `consume` decides and counts in one statement, mirroring better-auth's own
 * rule (a new window resets to one; at the limit the request is refused and the
 * window is not extended), so simultaneous requests cannot each slip past the
 * check before the other's count lands.
 *
 * If the table cannot be reached the request is allowed and the failure
 * logged: a missing table must not stop people signing in.
 */
const rateLimitStore = {
  get: async (key: string) => {
    const [row] = await client<Row[]>`
      SELECT key, count, last_request::float8 AS "lastRequest" FROM auth_rate_limits WHERE key = ${key}
    `;
    return row ?? null;
  },

  set: async (key: string, value: { count: number; lastRequest: number }) => {
    await client`
      INSERT INTO auth_rate_limits (key, count, last_request) VALUES (${key}, ${value.count}, ${value.lastRequest})
      ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, last_request = EXCLUDED.last_request
    `;
  },

  consume: async (key: string, rule: { window: number; max: number }) => {
    const now = Date.now();
    const windowMs = rule.window * 1000;

    try {
      const [row] = await client<{ lastRequest: number }[]>`
        INSERT INTO auth_rate_limits AS r (key, count, last_request) VALUES (${key}, 1, ${now})
        ON CONFLICT (key) DO UPDATE SET
          count = CASE
            WHEN ${now} - r.last_request > ${windowMs} THEN 1
            WHEN r.count >= ${rule.max} THEN r.count
            ELSE r.count + 1
          END,
          last_request = CASE
            WHEN ${now} - r.last_request > ${windowMs} THEN ${now}
            WHEN r.count >= ${rule.max} THEN r.last_request
            ELSE ${now}
          END
        RETURNING last_request::float8 AS "lastRequest"
      `;
      prune();

      // Every allowed branch stamps this request's time; a refusal keeps the old one
      if (!row || row.lastRequest === now) return { allowed: true, retryAfter: null };

      return { allowed: false, retryAfter: Math.max(1, Math.ceil((row.lastRequest + windowMs - now) / 1000)) };
    } catch (error) {
      logger.error('[Better Auth] Rate-limit store unavailable; request allowed', { key, error });
      return { allowed: true, retryAfter: null };
    }
  },
};

export default rateLimitStore;
