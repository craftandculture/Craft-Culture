import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  partners,
  sourceRfqItems,
  sourceRfqQuotes,
  sourceRfqs,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import notifyPartnerOfQuoteSelection from '../utils/notifyPartnerOfQuoteSelection';

const finalizeRfqSchema = z.object({
  rfqId: z.string().uuid(),
});

interface PartnerSelection {
  partnerId: string;
  partnerName: string;
  items: Array<{
    itemId: string;
    quoteId: string;
    productName: string;
    quantity: number;
    quantityUnit: string;
    unitPriceUsd: number;
    lineTotalUsd: number;
  }>;
  totalUsd: number;
}

/**
 * Finalize RFQ selections and prepare for PO generation
 *
 * - Validates all required items have selections
 * - Updates RFQ status to 'finalized'
 * - Returns summary of selections by partner
 *
 * @example
 *   await trpcClient.source.admin.finalize.mutate({ rfqId: "uuid" });
 */
const adminFinalizeRfq = adminProcedure
  .input(finalizeRfqSchema)
  .mutation(async ({ input }) => {
    const { rfqId } = input;

    // 1. Verify RFQ exists and is in selectable state
    const [rfq] = await db.select().from(sourceRfqs).where(eq(sourceRfqs.id, rfqId));

    if (!rfq) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'RFQ not found',
      });
    }

    const allowedStatuses = ['selecting', 'comparing', 'collecting'];
    if (!allowedStatuses.includes(rfq.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `RFQ cannot be finalized from status '${rfq.status}'`,
      });
    }

    // 2. Get all items with their selected quotes
    const items = await db
      .select({
        id: sourceRfqItems.id,
        productName: sourceRfqItems.productName,
        quantity: sourceRfqItems.quantity,
        quantityUnit: sourceRfqItems.quantityUnit,
        selectedQuoteId: sourceRfqItems.selectedQuoteId,
        status: sourceRfqItems.status,
        finalPriceUsd: sourceRfqItems.finalPriceUsd,
      })
      .from(sourceRfqItems)
      .where(eq(sourceRfqItems.rfqId, rfqId));

    if (items.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'RFQ has no items',
      });
    }

    // 3. Check for items without selections
    const unselectedItems = items.filter(
      (item) => item.status !== 'selected' && item.status !== 'self_sourced' && item.status !== 'unsourceable'
    );

    if (unselectedItems.length > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${unselectedItems.length} item(s) have not been selected. Please select quotes for all items or mark them as unsourceable.`,
      });
    }

    // 4. Get selected quotes with partner info
    const selectedQuoteIds = items
      .filter((item) => item.selectedQuoteId)
      .map((item) => item.selectedQuoteId as string);

    if (selectedQuoteIds.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No items have selected quotes',
      });
    }

    const quotes = await db
      .select({
        id: sourceRfqQuotes.id,
        itemId: sourceRfqQuotes.itemId,
        partnerId: sourceRfqQuotes.partnerId,
        costPricePerCaseUsd: sourceRfqQuotes.costPricePerCaseUsd,
        partnerName: partners.businessName,
      })
      .from(sourceRfqQuotes)
      .leftJoin(partners, eq(sourceRfqQuotes.partnerId, partners.id))
      .where(inArray(sourceRfqQuotes.id, selectedQuoteIds));

    // 5. Group selections by partner
    const partnerSelectionsMap = new Map<string, PartnerSelection>();

    for (const quote of quotes) {
      const item = items.find((i) => i.selectedQuoteId === quote.id);
      if (!item) continue;

      const quantity = item.quantity ?? 1;
      const unitPriceUsd = Number(quote.costPricePerCaseUsd ?? item.finalPriceUsd ?? 0);
      const lineTotalUsd = unitPriceUsd * quantity;

      let partnerSelection = partnerSelectionsMap.get(quote.partnerId);

      if (!partnerSelection) {
        partnerSelection = {
          partnerId: quote.partnerId,
          partnerName: quote.partnerName ?? 'Unknown Partner',
          items: [],
          totalUsd: 0,
        };
        partnerSelectionsMap.set(quote.partnerId, partnerSelection);
      }

      partnerSelection.items.push({
        itemId: item.id,
        quoteId: quote.id,
        productName: item.productName,
        quantity,
        quantityUnit: item.quantityUnit,
        unitPriceUsd,
        lineTotalUsd,
      });

      partnerSelection.totalUsd += lineTotalUsd;
    }

    // 6. Update RFQ status to 'finalized'
    await db
      .update(sourceRfqs)
      .set({ status: 'finalized' })
      .where(eq(sourceRfqs.id, rfqId));

    // 7. Return partner groupings for PO preview
    const partnerSelections = Array.from(partnerSelectionsMap.values());
    const grandTotalUsd = partnerSelections.reduce((sum, ps) => sum + ps.totalUsd, 0);

    // 8. Notify partners that their quotes were selected (fire and forget)
    for (const partnerSelection of partnerSelections) {
      void notifyPartnerOfQuoteSelection({
        rfqId,
        partnerId: partnerSelection.partnerId,
        selectedItemCount: partnerSelection.items.length,
        totalAmountUsd: partnerSelection.totalUsd,
      });
    }

    return {
      rfqId,
      status: 'finalized',
      partnerSelections,
      summary: {
        totalPartners: partnerSelections.length,
        totalItems: items.filter((i) => i.status === 'selected').length,
        grandTotalUsd,
        selfSourcedCount: items.filter((i) => i.status === 'self_sourced').length,
        unsourceableCount: items.filter((i) => i.status === 'unsourceable').length,
      },
    };
  });

export default adminFinalizeRfq;
