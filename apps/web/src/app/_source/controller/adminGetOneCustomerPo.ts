import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  partners,
  sourceCustomerPoItems,
  sourceCustomerPos,
  sourceRfqQuotes,
  sourceRfqs,
  sourceSupplierOrderItems,
  sourceSupplierOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import getOneCustomerPoSchema from '../schemas/getOneCustomerPoSchema';

/**
 * Get a single Customer PO with all related data
 *
 * @example
 *   await trpcClient.source.admin.customerPo.getOne.query({
 *     id: "uuid-here",
 *   });
 */
const adminGetOneCustomerPo = adminProcedure
  .input(getOneCustomerPoSchema)
  .query(async ({ input }) => {
    const { id } = input;

    // Get the customer PO
    const [customerPo] = await db
      .select()
      .from(sourceCustomerPos)
      .where(eq(sourceCustomerPos.id, id))
      .limit(1);

    if (!customerPo) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Customer PO not found',
      });
    }

    // Get the linked RFQ if exists
    let rfq = null;
    if (customerPo.rfqId) {
      const [rfqResult] = await db
        .select({
          id: sourceRfqs.id,
          rfqNumber: sourceRfqs.rfqNumber,
          name: sourceRfqs.name,
          status: sourceRfqs.status,
        })
        .from(sourceRfqs)
        .where(eq(sourceRfqs.id, customerPo.rfqId))
        .limit(1);
      rfq = rfqResult || null;
    }

    // Get all items with their matched quote details
    const items = await db
      .select({
        id: sourceCustomerPoItems.id,
        productName: sourceCustomerPoItems.productName,
        producer: sourceCustomerPoItems.producer,
        vintage: sourceCustomerPoItems.vintage,
        region: sourceCustomerPoItems.region,
        lwin: sourceCustomerPoItems.lwin,
        quantity: sourceCustomerPoItems.quantity,
        quantityUnit: sourceCustomerPoItems.quantityUnit,
        caseConfig: sourceCustomerPoItems.caseConfig,
        bottleSize: sourceCustomerPoItems.bottleSize,
        sellPricePerCaseUsd: sourceCustomerPoItems.sellPricePerCaseUsd,
        sellPricePerBottleUsd: sourceCustomerPoItems.sellPricePerBottleUsd,
        sellLineTotalUsd: sourceCustomerPoItems.sellLineTotalUsd,
        matchedQuoteId: sourceCustomerPoItems.matchedQuoteId,
        buyPricePerCaseUsd: sourceCustomerPoItems.buyPricePerCaseUsd,
        buyPricePerBottleUsd: sourceCustomerPoItems.buyPricePerBottleUsd,
        buyLineTotalUsd: sourceCustomerPoItems.buyLineTotalUsd,
        profitUsd: sourceCustomerPoItems.profitUsd,
        profitMarginPercent: sourceCustomerPoItems.profitMarginPercent,
        isLosingItem: sourceCustomerPoItems.isLosingItem,
        status: sourceCustomerPoItems.status,
        matchSource: sourceCustomerPoItems.matchSource,
        adminNotes: sourceCustomerPoItems.adminNotes,
        sortOrder: sourceCustomerPoItems.sortOrder,
      })
      .from(sourceCustomerPoItems)
      .where(eq(sourceCustomerPoItems.customerPoId, id))
      .orderBy(sourceCustomerPoItems.sortOrder);

    // Get matched quote details with partner info
    const itemsWithQuotes = await Promise.all(
      items.map(async (item) => {
        let matchedQuote = null;
        if (item.matchedQuoteId) {
          const [quoteResult] = await db
            .select({
              id: sourceRfqQuotes.id,
              partnerId: sourceRfqQuotes.partnerId,
              costPricePerCaseUsd: sourceRfqQuotes.costPricePerCaseUsd,
              quotedVintage: sourceRfqQuotes.quotedVintage,
              caseConfig: sourceRfqQuotes.caseConfig,
              bottleSize: sourceRfqQuotes.bottleSize,
              leadTimeDays: sourceRfqQuotes.leadTimeDays,
              stockLocation: sourceRfqQuotes.stockLocation,
              partnerName: partners.businessName,
            })
            .from(sourceRfqQuotes)
            .leftJoin(partners, eq(sourceRfqQuotes.partnerId, partners.id))
            .where(eq(sourceRfqQuotes.id, item.matchedQuoteId))
            .limit(1);
          matchedQuote = quoteResult || null;
        }
        return { ...item, matchedQuote };
      }),
    );

    // Get supplier orders
    const supplierOrders = await db
      .select({
        id: sourceSupplierOrders.id,
        orderNumber: sourceSupplierOrders.orderNumber,
        partnerId: sourceSupplierOrders.partnerId,
        status: sourceSupplierOrders.status,
        itemCount: sourceSupplierOrders.itemCount,
        totalAmountUsd: sourceSupplierOrders.totalAmountUsd,
        confirmedAmountUsd: sourceSupplierOrders.confirmedAmountUsd,
        sentAt: sourceSupplierOrders.sentAt,
        confirmedAt: sourceSupplierOrders.confirmedAt,
        partnerName: partners.businessName,
      })
      .from(sourceSupplierOrders)
      .leftJoin(partners, eq(sourceSupplierOrders.partnerId, partners.id))
      .where(eq(sourceSupplierOrders.customerPoId, id));

    // Get supplier order items for each order
    const ordersWithItems = await Promise.all(
      supplierOrders.map(async (order) => {
        const orderItems = await db
          .select()
          .from(sourceSupplierOrderItems)
          .where(eq(sourceSupplierOrderItems.supplierOrderId, order.id));
        return { ...order, items: orderItems };
      }),
    );

    return {
      ...customerPo,
      rfq,
      items: itemsWithQuotes,
      supplierOrders: ordersWithItems,
    };
  });

export default adminGetOneCustomerPo;
