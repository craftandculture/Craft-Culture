import { TRPCError } from '@trpc/server';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';

import db from '@/database/client';
import {
  partners,
  sourceCustomerPoItems,
  sourceCustomerPos,
  sourceRfqQuotes,
  sourceSupplierOrderItems,
  sourceSupplierOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import generateSupplierOrdersSchema from '../schemas/generateSupplierOrdersSchema';
import formatLwin18 from '../utils/formatLwin18';
import generateSupplierOrderNumber from '../utils/generateSupplierOrderNumber';

/**
 * Generate supplier orders from matched Customer PO items
 * Groups items by partner and creates one order per partner
 *
 * @example
 *   await trpcClient.source.admin.customerPo.generateSupplierOrders.mutate({
 *     customerPoId: "uuid-here",
 *   });
 */
const adminGenerateSupplierOrders = adminProcedure
  .input(generateSupplierOrdersSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    try {
      const { customerPoId, itemIds } = input;

      // Verify customer PO exists
      const [customerPo] = await db
        .select()
        .from(sourceCustomerPos)
        .where(eq(sourceCustomerPos.id, customerPoId))
        .limit(1);

      if (!customerPo) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer PO not found',
        });
      }

      // Get matched items (either specified items or all matched items)
      const itemConditions = [
        eq(sourceCustomerPoItems.customerPoId, customerPoId),
        isNotNull(sourceCustomerPoItems.matchedQuoteId),
        eq(sourceCustomerPoItems.status, 'matched'),
      ];

      if (itemIds && itemIds.length > 0) {
        itemConditions.push(inArray(sourceCustomerPoItems.id, itemIds));
      }

      const matchedItems = await db
        .select()
        .from(sourceCustomerPoItems)
        .where(and(...itemConditions));

      if (matchedItems.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No matched items found to generate orders',
        });
      }

      // Get quote details for matched items
      const quoteIds = matchedItems
        .map((item) => item.matchedQuoteId)
        .filter((id): id is string => id !== null);

      const quotes = await db
        .select({
          id: sourceRfqQuotes.id,
          partnerId: sourceRfqQuotes.partnerId,
          costPricePerCaseUsd: sourceRfqQuotes.costPricePerCaseUsd,
          quotedVintage: sourceRfqQuotes.quotedVintage,
          caseConfig: sourceRfqQuotes.caseConfig,
          bottleSize: sourceRfqQuotes.bottleSize,
          leadTimeDays: sourceRfqQuotes.leadTimeDays,
        })
        .from(sourceRfqQuotes)
        .where(inArray(sourceRfqQuotes.id, quoteIds));

      const quoteMap = new Map(quotes.map((q) => [q.id, q]));

      // Group items by partner
      const itemsByPartner = new Map<
        string,
        Array<{
          item: (typeof matchedItems)[0];
          quote: (typeof quotes)[0];
        }>
      >();

      matchedItems.forEach((item) => {
        const quote = quoteMap.get(item.matchedQuoteId!);
        if (!quote) return;

        const partnerId = quote.partnerId;
        if (!itemsByPartner.has(partnerId)) {
          itemsByPartner.set(partnerId, []);
        }
        itemsByPartner.get(partnerId)!.push({ item, quote });
      });

      // Get partner details
      const partnerIds = Array.from(itemsByPartner.keys());
      const partnerDetails = await db
        .select({ id: partners.id, businessName: partners.businessName })
        .from(partners)
        .where(inArray(partners.id, partnerIds));
      const partnerMap = new Map(partnerDetails.map((p) => [p.id, p]));

      // Create supplier orders for each partner
      const createdOrders: Array<{
        orderId: string;
        orderNumber: string;
        partnerId: string;
        partnerName: string;
        itemCount: number;
        totalAmountUsd: number;
      }> = [];

      for (const [partnerId, partnerItems] of itemsByPartner) {
        const partner = partnerMap.get(partnerId);
        if (!partner) continue;

        const orderNumber = await generateSupplierOrderNumber();

        // Calculate totals
        let totalAmountUsd = 0;
        partnerItems.forEach(({ item, quote }) => {
          const qty = item.quantityCases || 1;
          const price = quote.costPricePerCaseUsd || 0;
          totalAmountUsd += price * qty;
        });

        // Create supplier order
        const [supplierOrder] = await db
          .insert(sourceSupplierOrders)
          .values({
            customerPoId,
            partnerId,
            orderNumber,
            status: 'draft',
            itemCount: partnerItems.length,
            totalAmountUsd: Math.round(totalAmountUsd * 100) / 100,
            createdBy: user.id,
          })
          .returning();

        if (!supplierOrder) continue;

        // Create supplier order items
        const orderItemsData = partnerItems.map(({ item, quote }, idx) => {
          const qty = item.quantityCases || 1;
          const costPerCase = quote.costPricePerCaseUsd || 0;
          const caseConfigNum = parseInt(
            quote.caseConfig || item.caseConfig || '6',
            10,
          );
          const costPerBottle =
            caseConfigNum > 0 ? costPerCase / caseConfigNum : 0;
          const quantityBottles = qty * caseConfigNum;

          // Generate LWIN18
          const lwin18 = formatLwin18({
            lwin: item.lwin,
            vintage: quote.quotedVintage || item.vintage,
            bottleSize: quote.bottleSize || item.bottleSize || '750ml',
            caseConfig: caseConfigNum,
          });

          return {
            supplierOrderId: supplierOrder.id,
            customerPoItemId: item.id,
            quoteId: quote.id,
            productName: item.productName,
            producer: item.producer,
            vintage: quote.quotedVintage || item.vintage,
            lwin7: item.lwin,
            lwin18,
            caseConfig: `${caseConfigNum}x75cl`,
            quantityCases: qty,
            quantityBottles,
            costPerBottleUsd: Math.round(costPerBottle * 100) / 100,
            costPerCaseUsd: costPerCase,
            lineTotalUsd: Math.round(costPerCase * qty * 100) / 100,
            confirmationStatus: 'pending' as const,
            sortOrder: idx + 1,
          };
        });

        await db.insert(sourceSupplierOrderItems).values(orderItemsData);

        // Update customer PO items status
        const itemIdsToUpdate = partnerItems.map(({ item }) => item.id);
        await db
          .update(sourceCustomerPoItems)
          .set({ status: 'ordered', updatedAt: new Date() })
          .where(inArray(sourceCustomerPoItems.id, itemIdsToUpdate));

        createdOrders.push({
          orderId: supplierOrder.id,
          orderNumber,
          partnerId,
          partnerName: partner.businessName,
          itemCount: partnerItems.length,
          totalAmountUsd: Math.round(totalAmountUsd * 100) / 100,
        });
      }

      // Update customer PO status
      await db
        .update(sourceCustomerPos)
        .set({
          status: 'orders_generated',
          ordersGeneratedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(sourceCustomerPos.id, customerPoId));

      return {
        success: true,
        ordersCreated: createdOrders.length,
        orders: createdOrders,
      };
    } catch (error) {
      logger.error('Error generating supplier orders:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to generate supplier orders. Please try again.',
      });
    }
  });

export default adminGenerateSupplierOrders;
