import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsMovementBonds, logisticsShipmentActivityLogs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { saveBondSchema } from '../schemas/exportJobSchemas';

const STEP_NOTES = {
  paidOn: 'Bond paid',
  arrivedOn: 'Goods arrived at destination bond',
  stampedOn: 'Stamped paperwork received',
  claimSubmittedOn: 'Bond claim submitted',
  refundedOn: 'Bond refunded',
} as const;

/**
 * Record a movement bond's figures or its next step
 *
 * The bond is half the goods value unless customs assessed it otherwise, so a
 * goods value entered with no bond amount, on a bond that has none yet, sets
 * it at 50%. Each step that gains a date is written to the job's history.
 *
 * @example
 *   await trpcClient.logistics.admin.exports.saveBond.mutate({ shipmentId, claimSubmittedOn: '2026-11-02' });
 */
const adminSaveBond = adminProcedure.input(saveBondSchema).mutation(async ({ input, ctx: { user } }) => {
  const { shipmentId, ...fields } = input;

  const [bond] = await db
    .select()
    .from(logisticsMovementBonds)
    .where(eq(logisticsMovementBonds.shipmentId, shipmentId));

  if (!bond) throw new TRPCError({ code: 'NOT_FOUND', message: 'This job has no movement bond' });

  const bondAmount =
    fields.bondAmount !== undefined
      ? fields.bondAmount
      : fields.goodsValue != null && bond.bondAmount == null
        ? Math.round(fields.goodsValue * 50) / 100
        : undefined;

  const changes = Object.fromEntries(
    Object.entries({ ...fields, bondAmount }).filter(([, v]) => v !== undefined),
  );

  await db
    .update(logisticsMovementBonds)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(logisticsMovementBonds.shipmentId, shipmentId));

  const stepsDone = (Object.keys(STEP_NOTES) as (keyof typeof STEP_NOTES)[]).filter(
    (key) => fields[key] && fields[key] !== bond[key],
  );

  if (stepsDone.length) {
    await db.insert(logisticsShipmentActivityLogs).values(
      stepsDone.map((key) => ({
        shipmentId,
        userId: user.id,
        action: 'bond_updated',
        notes: `${STEP_NOTES[key]} (${fields[key]})`,
      })),
    );
  }

  return { ok: true };
});

export default adminSaveBond;
