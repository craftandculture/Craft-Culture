import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partners, privateClientOrders, zohoSalesOrders } from '@/database/schema';

/**
 * The distributor an order is being fulfilled for
 *
 * A Zoho sales order belongs to the partner whose Zoho contact is the order's
 * customer, else to the distributor of the private client order it fulfils.
 * A private client order names its distributor.
 *
 * @param orderId - A Zoho sales order or private client order id
 * @returns The distributor's partner id, or null when there is none
 */
const findOrderDistributor = async (orderId: string) => {
  const [zoho] = await db
    .select({ customerId: zohoSalesOrders.zohoCustomerId, pcoId: zohoSalesOrders.privateClientOrderId })
    .from(zohoSalesOrders)
    .where(eq(zohoSalesOrders.id, orderId))
    .limit(1);

  if (zoho) {
    const [partner] = await db
      .select({ id: partners.id })
      .from(partners)
      .where(eq(partners.zohoContactId, zoho.customerId))
      .limit(1);
    if (partner) return partner.id;
    if (!zoho.pcoId) return null;
  }

  const [pco] = await db
    .select({ distributorId: privateClientOrders.distributorId })
    .from(privateClientOrders)
    .where(eq(privateClientOrders.id, zoho?.pcoId ?? orderId))
    .limit(1);

  return pco?.distributorId ?? null;
};

export default findOrderDistributor;
