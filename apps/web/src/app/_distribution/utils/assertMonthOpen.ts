import { TRPCError } from '@trpc/server';

import { client } from '@/database/client';

import tableReady from './tableReady';

/**
 * Refuse a change to a month that has been approved
 *
 * An approved month has raised a Zoho invoice to the outlet and a bill to each
 * owner on the figures it showed that day. Re-reading its report, confirming a
 * sale into it or adding an adjustment afterwards would change figures that
 * have already left the building, so the change belongs in the next month as
 * an adjustment instead.
 *
 * @example
 *   await assertMonthOpen(outletId, '2026-10');
 *
 * @param outletId - The outlet
 * @param month - The month, YYYY-MM
 */
const assertMonthOpen = async (outletId: string, month: string) => {
  if (!(await tableReady('cons_month_closes'))) return;

  const [closed] = await client<{ approvedAt: string }[]>`
    SELECT approved_at::text AS "approvedAt"
    FROM cons_month_closes
    WHERE outlet_id = ${outletId} AND month = ${month}
  `;

  if (closed) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `${month} was approved on ${closed.approvedAt.slice(0, 10)} and is locked. Record the change as an adjustment in a later month.`,
    });
  }
};

export default assertMonthOpen;
