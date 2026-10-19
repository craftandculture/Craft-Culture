import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import orderCheckFilesReady from '../utils/orderCheckFilesReady';

interface Row {
  soNumber: string;
  customerName: string | null;
  lpoNumber: string | null;
  lastStatus: string | null;
  lastCounts: { error: number; warning: number; info: number } | null;
  lastCheckedAt: Date | null;
  signedOffAt: Date | null;
  signedOffBy: string | null;
  signedOffStatus: string | null;
}

/**
 * Orders checked recently, newest first, with where each one stands
 *
 * Read from the last result kept for each order, not from Zoho, so the list is
 * instant; opening an order checks it again live.
 *
 * @example
 *   const { rows } = await trpcClient.orderChecks.list.query();
 */
const adminListOrderChecks = adminProcedure.query(async () => {
  if (!(await orderCheckFilesReady())) return { ready: false, rows: [] as Row[] };

  const rows = await client<Row[]>`
    SELECT f.so_number AS "soNumber", f.customer_name AS "customerName", f.lpo_number AS "lpoNumber",
           f.last_status AS "lastStatus", f.last_counts AS "lastCounts", f.last_checked_at AS "lastCheckedAt",
           f.signed_off_at AS "signedOffAt", u.name AS "signedOffBy", f.signed_off_status AS "signedOffStatus"
    FROM order_check_files f
    LEFT JOIN users u ON u.id = f.signed_off_by
    ORDER BY f.updated_at DESC
    LIMIT 50
  `;

  return { ready: true, rows };
});

export default adminListOrderChecks;
