import { TRPCError } from '@trpc/server';
import { inArray } from 'drizzle-orm';

import db from '@/database/client';
import { privateClientOrders } from '@/database/schema';

/**
 * Run one action over several orders, one at a time, and report each
 *
 * A bulk action is the single-order action repeated, so each order gets
 * exactly its own checks, log entry and notifications. One order failing
 * (wrong status, say) does not stop the rest; the result names it and why.
 *
 * @param orderIds - The orders
 * @param action - The single-order action
 * @returns One result per order, in the order given
 */
const runForEachOrder = async (
  orderIds: string[],
  action: (orderId: string) => Promise<unknown>,
) => {
  const numbers = await db
    .select({ id: privateClientOrders.id, orderNumber: privateClientOrders.orderNumber })
    .from(privateClientOrders)
    .where(inArray(privateClientOrders.id, orderIds));
  const numberById = new Map(numbers.map((o) => [o.id, o.orderNumber]));

  const results: { orderId: string; orderNumber: string; ok: boolean; message?: string }[] = [];

  for (const orderId of orderIds) {
    const orderNumber = numberById.get(orderId) ?? orderId;
    try {
      await action(orderId);
      results.push({ orderId, orderNumber, ok: true });
    } catch (error) {
      results.push({
        orderId,
        orderNumber,
        ok: false,
        message:
          error instanceof TRPCError || error instanceof Error
            ? error.message
            : 'Failed',
      });
    }
  }

  return {
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok),
    results,
  };
};

export default runForEachOrder;
