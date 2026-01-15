import { TRPCError } from '@trpc/server';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  partners,
  sourceCustomerPoItems,
  sourceCustomerPos,
  sourceRfqItems,
  sourceRfqQuotes,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const getAvailableSuppliersSchema = z.object({
  customerPoId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).optional(),
});

/**
 * Get available suppliers for a Customer PO based on linked RFQ quotes
 *
 * Returns partners who have submitted quotes for items that match
 * the customer PO items, along with quote counts and totals.
 *
 * @example
 *   await trpcClient.source.admin.customerPo.getAvailableSuppliers.query({
 *     customerPoId: "uuid",
 *     itemIds: ["item-uuid-1", "item-uuid-2"], // optional filter
 *   });
 */
const adminGetAvailableSuppliers = adminProcedure
  .input(getAvailableSuppliersSchema)
  .query(async ({ input }) => {
    const { customerPoId, itemIds } = input;

    // Get the customer PO with linked RFQ
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

    if (!customerPo.rfqId) {
      return { suppliers: [], message: 'No linked RFQ' };
    }

    // Get Customer PO items (filtered if itemIds provided)
    const poItemsQuery = db
      .select()
      .from(sourceCustomerPoItems)
      .where(
        itemIds && itemIds.length > 0
          ? and(
              eq(sourceCustomerPoItems.customerPoId, customerPoId),
              inArray(sourceCustomerPoItems.id, itemIds)
            )
          : eq(sourceCustomerPoItems.customerPoId, customerPoId)
      );

    const poItems = await poItemsQuery;

    if (poItems.length === 0) {
      return { suppliers: [], message: 'No items found' };
    }

    // Get all RFQ items for the linked RFQ
    const rfqItems = await db
      .select()
      .from(sourceRfqItems)
      .where(eq(sourceRfqItems.rfqId, customerPo.rfqId));

    // Get all quotes for these RFQ items with partner info
    const rfqItemIds = rfqItems.map((i) => i.id);

    if (rfqItemIds.length === 0) {
      return { suppliers: [], message: 'No RFQ items found' };
    }

    const quotes = await db
      .select({
        id: sourceRfqQuotes.id,
        rfqItemId: sourceRfqQuotes.rfqItemId,
        partnerId: sourceRfqQuotes.partnerId,
        costPricePerCaseUsd: sourceRfqQuotes.costPricePerCaseUsd,
        quotedVintage: sourceRfqQuotes.quotedVintage,
        partnerName: partners.businessName,
      })
      .from(sourceRfqQuotes)
      .leftJoin(partners, eq(sourceRfqQuotes.partnerId, partners.id))
      .where(
        and(
          inArray(sourceRfqQuotes.rfqItemId, rfqItemIds),
          isNotNull(sourceRfqQuotes.costPricePerCaseUsd)
        )
      );

    // Group quotes by partner
    const supplierMap = new Map<
      string,
      {
        partnerId: string;
        partnerName: string;
        quoteCount: number;
        totalBuyPrice: number;
        quotes: typeof quotes;
      }
    >();

    quotes.forEach((quote) => {
      if (!quote.partnerId || !quote.partnerName) return;

      const existing = supplierMap.get(quote.partnerId);
      if (existing) {
        existing.quoteCount++;
        existing.totalBuyPrice += quote.costPricePerCaseUsd || 0;
        existing.quotes.push(quote);
      } else {
        supplierMap.set(quote.partnerId, {
          partnerId: quote.partnerId,
          partnerName: quote.partnerName,
          quoteCount: 1,
          totalBuyPrice: quote.costPricePerCaseUsd || 0,
          quotes: [quote],
        });
      }
    });

    // Calculate how many PO items each supplier can fulfill
    const suppliers = Array.from(supplierMap.values()).map((supplier) => {
      // Count how many PO items this supplier has quotes for
      // This requires matching PO items to RFQ items (by product name/LWIN)
      let matchableItems = 0;

      poItems.forEach((poItem) => {
        // Find RFQ items that match this PO item
        const matchingRfqItems = rfqItems.filter((rfqItem) => {
          // Match by LWIN if both have it
          if (poItem.lwin && rfqItem.lwin) {
            return poItem.lwin === rfqItem.lwin;
          }
          // Match by product name (case insensitive)
          const poName = (poItem.productName || '').toLowerCase();
          const rfqName = (rfqItem.productName || '').toLowerCase();
          return poName.includes(rfqName) || rfqName.includes(poName);
        });

        // Check if supplier has quotes for any of these RFQ items
        const hasQuote = matchingRfqItems.some((rfqItem) =>
          supplier.quotes.some((q) => q.rfqItemId === rfqItem.id)
        );

        if (hasQuote) matchableItems++;
      });

      return {
        partnerId: supplier.partnerId,
        partnerName: supplier.partnerName,
        quoteCount: supplier.quoteCount,
        matchableItems,
        totalItems: poItems.length,
        coverage: Math.round((matchableItems / poItems.length) * 100),
      };
    });

    // Sort by coverage (most items covered first)
    suppliers.sort((a, b) => b.coverage - a.coverage);

    return { suppliers, totalItems: poItems.length };
  });

export default adminGetAvailableSuppliers;
