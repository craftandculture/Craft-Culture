import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { privateClientOrders } from '@/database/schema';

import { DISTRIBUTOR_SKU_LOCKED_STATUSES } from '../constants';
import normalizeDistributorSku from './normalizeDistributorSku';


/**
 * Record the distributor's bundle SKU on an order, or clear it
 *
 * @param input.orderId - The order
 * @param input.sku - The SKU as typed; empty or null clears it
 * @param author.userId - Who set it
 * @param author.source - 'distributor' or 'admin'
 * @param author.distributorId - When set, the order must be assigned to it
 * @returns The order's saved SKU fields
 */
const setDistributorSku = async (
  input: { orderId: string; sku: string | null },
  author: {
    userId: string;
    source: 'distributor' | 'admin';
    distributorId?: string;
  },
) => {
  const sku = input.sku?.trim() ? normalizeDistributorSku(input.sku) : null;

  const order = await db.query.privateClientOrders.findFirst({
    where: { id: input.orderId },
    columns: { id: true, distributorId: true, status: true },
  });

  if (!order || (author.distributorId && order.distributorId !== author.distributorId)) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
  }

  // Once paid the SKU is what was invoiced against; only C&C may correct it
  if (author.source === 'distributor' && DISTRIBUTOR_SKU_LOCKED_STATUSES.includes(order.status)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'The SKU can no longer be changed here. Ask Craft & Culture to correct it.',
    });
  }

  const [updated] = await db
    .update(privateClientOrders)
    .set({
      distributorSku: sku,
      distributorSkuSource: sku ? author.source : null,
      distributorSkuSetAt: sku ? new Date() : null,
      distributorSkuSetBy: sku ? author.userId : null,
      ...(sku ? {} : { distributorRef: null }),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(privateClientOrders.id, input.orderId),
        author.distributorId
          ? eq(privateClientOrders.distributorId, author.distributorId)
          : undefined,
      ),
    )
    .returning({
      id: privateClientOrders.id,
      distributorSku: privateClientOrders.distributorSku,
      distributorSkuSource: privateClientOrders.distributorSkuSource,
    });

  return updated!;
};

export default setDistributorSku;
