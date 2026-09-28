import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import fetchCityDrinksStock from '@/app/_distribution/data/fetchCityDrinksStock';
import db, { client } from '@/database/client';
import { consOutlets, partners, privateClientOrders } from '@/database/schema';
import logger from '@/utils/logger';

import linkBundleSkusFromFeed from './linkBundleSkusFromFeed';

/**
 * Refuse to mark an order client-paid until its distributor SKU is recorded
 *
 * Only for distributors that sell each PCO as its own product
 * (`requiresOrderSku`, i.e. City Drinks). Before refusing, the distributor's
 * feed is pulled live once for this order: if they have already created the
 * bundle, its SKU is taken from there and the payment goes through. A feed
 * that is down or slow counts as "not found" — it never breaks the payment
 * screen, it just asks for the SKU to be typed.
 *
 * @param orderId - The order about to become client_paid
 * @throws TRPCError PRECONDITION_FAILED when the SKU is still missing
 */
const assertDistributorSku = async (orderId: string) => {
  const [row] = await db
    .select({
      orderNumber: privateClientOrders.orderNumber,
      distributorId: privateClientOrders.distributorId,
      distributorSku: privateClientOrders.distributorSku,
      requiresOrderSku: partners.requiresOrderSku,
      distributorName: partners.businessName,
    })
    .from(privateClientOrders)
    .leftJoin(partners, eq(privateClientOrders.distributorId, partners.id))
    .where(eq(privateClientOrders.id, orderId));

  if (!row?.requiresOrderSku || row.distributorSku || !row.distributorId) return;

  const [outlet] = await db
    .select({
      id: consOutlets.id,
      name: consOutlets.name,
      apiUrl: consOutlets.apiUrl,
      apiTokenEnv: consOutlets.apiTokenEnv,
    })
    .from(consOutlets)
    .where(eq(consOutlets.partnerId, row.distributorId))
    .limit(1);

  if (outlet) {
    try {
      const parsed = await fetchCityDrinksStock(outlet);
      const { linked } = await linkBundleSkusFromFeed(client, {
        outletId: outlet.id,
        rows: parsed.rows,
        orderNumbers: [row.orderNumber],
      });
      if (linked > 0) return;
    } catch (error) {
      logger.warn('Live feed lookup for the order SKU failed', {
        orderId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw new TRPCError({
    code: 'PRECONDITION_FAILED',
    message: `Add the ${row.distributorName ?? 'distributor'} SKU for ${row.orderNumber} before confirming payment.`,
  });
};

export default assertDistributorSku;
