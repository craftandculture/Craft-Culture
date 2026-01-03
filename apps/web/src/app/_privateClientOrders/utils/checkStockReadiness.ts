import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { privateClientOrderItems } from '@/database/schema';

interface StockReadinessResult {
  allReady: boolean;
  readyCount: number;
  totalCount: number;
  pendingItems: {
    id: string;
    productName: string;
    stockStatus: string | null;
  }[];
}

/**
 * Check if all line items for an order have stock at distributor
 *
 * This is used to enforce workflow gates - orders cannot be dispatched
 * for delivery until all stock items are at the distributor location.
 *
 * @param orderId - The order ID to check
 * @param requiredStatus - The minimum stock status required (default: 'at_distributor')
 * @returns Object with readiness status and details about pending items
 */
const checkStockReadiness = async (
  orderId: string,
  requiredStatus: 'at_cc_bonded' | 'at_distributor' = 'at_distributor',
): Promise<StockReadinessResult> => {
  // Valid statuses for the given threshold
  const validStatuses = {
    at_cc_bonded: ['at_cc_bonded', 'at_distributor', 'delivered'],
    at_distributor: ['at_distributor', 'delivered'],
  } as const;

  const allowedStatuses = validStatuses[requiredStatus];

  // Get all line items for the order
  const items = await db
    .select({
      id: privateClientOrderItems.id,
      productName: privateClientOrderItems.productName,
      stockStatus: privateClientOrderItems.stockStatus,
    })
    .from(privateClientOrderItems)
    .where(eq(privateClientOrderItems.orderId, orderId));

  const readyItems = items.filter(
    (item) =>
      item.stockStatus && (allowedStatuses as readonly string[]).includes(item.stockStatus),
  );
  const pendingItems = items.filter(
    (item) =>
      !item.stockStatus || !(allowedStatuses as readonly string[]).includes(item.stockStatus),
  );

  return {
    allReady: pendingItems.length === 0 && items.length > 0,
    readyCount: readyItems.length,
    totalCount: items.length,
    pendingItems: pendingItems.map((item) => ({
      id: item.id,
      productName: item.productName,
      stockStatus: item.stockStatus,
    })),
  };
};

export default checkStockReadiness;
