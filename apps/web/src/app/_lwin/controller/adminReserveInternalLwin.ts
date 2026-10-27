import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

/** Highest code issued before the system tracked them */
const ISSUED_OFF_SYSTEM = 9000007;

/**
 * Take the next C&C internal LWIN7 for a new wine
 *
 * The lookup only previews a number; two people adding wines at once were both
 * shown, and both used, the same code. Reserving takes a lock, starts from
 * whichever is higher — the highest code in use anywhere or the last code
 * handed out — and records the one it returns, so it is never offered again.
 *
 * @example
 *   const { lwin7 } = await trpcClient.lwin.reserveInternal.mutate();
 *
 * @returns The reserved 7-digit code
 */
const adminReserveInternalLwin = adminProcedure.mutation(async () => {
  try {
    const lwin7 = await client.begin(async (sql) => {
      await sql`SELECT pg_advisory_xact_lock(hashtext('cc_internal_lwin7'))`;

      const [inUse] = await sql<{ highest: number | null }[]>`
        SELECT MAX(LEFT(code, 7)::int) AS highest
        FROM (
          SELECT lwin18 AS code FROM products
          UNION ALL SELECT lwin FROM logistics_shipment_items
          UNION ALL SELECT lwin18 FROM wms_stock
          UNION ALL SELECT lwin FROM private_client_order_items
        ) codes
        WHERE code ~ '^9[0-9]{6}(-|$|[0-9]{11}$)'
      `;

      const [seq] = await sql<{ last_value: string; is_called: boolean }[]>`
        SELECT last_value, is_called FROM cc_internal_lwin7_seq
      `;

      const lastIssued = seq
        ? Number(seq.last_value) - (seq.is_called ? 0 : 1)
        : 0;

      const next =
        Math.max(Number(inUse?.highest ?? 0), lastIssued, ISSUED_OFF_SYSTEM) +
        1;

      await sql`SELECT setval('cc_internal_lwin7_seq', ${next}::bigint, true)`;

      return next;
    });

    return { lwin7: String(lwin7) };
  } catch (error) {
    logger.error('Could not reserve an internal LWIN', { error });

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message:
        'Could not reserve a new C&C code. Try again, or ask for the database migration to be checked.',
    });
  }
});

export default adminReserveInternalLwin;
