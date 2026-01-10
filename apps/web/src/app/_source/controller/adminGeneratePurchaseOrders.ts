import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  partners,
  sourcePurchaseOrderItems,
  sourcePurchaseOrders,
  sourceRfqItems,
  sourceRfqQuotes,
  sourceRfqs,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import generatePoNumber from '../utils/generatePoNumber';

const generatePurchaseOrdersSchema = z.object({
  rfqId: z.string().uuid(),
  deliveryAddress: z.string().optional(),
  deliveryInstructions: z.string().optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
});

interface GeneratedPO {
  id: string;
  poNumber: string;
  partnerId: string;
  partnerName: string;
  itemCount: number;
  totalAmountUsd: number;
}

/**
 * Generate Purchase Orders from a finalized RFQ
 *
 * - Creates one PO per partner with selected quotes
 * - Generates unique PO numbers in format PO-YYYY-NNNN
 * - Creates PO item records with denormalized product details
 * - Updates RFQ status to 'po_generated'
 *
 * @example
 *   await trpcClient.source.admin.generatePurchaseOrders.mutate({
 *     rfqId: "uuid",
 *     deliveryAddress: "Dubai, UAE",
 *     paymentTerms: "Net 30",
 *   });
 */
const adminGeneratePurchaseOrders = adminProcedure
  .input(generatePurchaseOrdersSchema)
  .mutation(async ({ input, ctx }) => {
    const { rfqId, deliveryAddress, deliveryInstructions, paymentTerms, notes } = input;
    const userId = ctx.user.id;

    // 1. Verify RFQ exists and is finalized
    const [rfq] = await db.select().from(sourceRfqs).where(eq(sourceRfqs.id, rfqId));

    if (!rfq) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'RFQ not found',
      });
    }

    if (rfq.status !== 'finalized') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `RFQ must be finalized before generating POs. Current status: '${rfq.status}'`,
      });
    }

    // 2. Get all items with selected quotes
    const items = await db
      .select({
        id: sourceRfqItems.id,
        productName: sourceRfqItems.productName,
        producer: sourceRfqItems.producer,
        vintage: sourceRfqItems.vintage,
        lwin: sourceRfqItems.lwin,
        quantity: sourceRfqItems.quantity,
        quantityUnit: sourceRfqItems.quantityUnit,
        caseConfig: sourceRfqItems.caseConfig,
        selectedQuoteId: sourceRfqItems.selectedQuoteId,
        finalPriceUsd: sourceRfqItems.finalPriceUsd,
        status: sourceRfqItems.status,
      })
      .from(sourceRfqItems)
      .where(eq(sourceRfqItems.rfqId, rfqId));

    // Filter to only items with selected quotes
    const selectedItems = items.filter(
      (item) => item.status === 'selected' && item.selectedQuoteId
    );

    if (selectedItems.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No items have selected quotes',
      });
    }

    // 3. Get selected quotes with partner info
    const selectedQuoteIds = selectedItems.map((item) => item.selectedQuoteId as string);

    const quotes = await db
      .select({
        id: sourceRfqQuotes.id,
        itemId: sourceRfqQuotes.itemId,
        partnerId: sourceRfqQuotes.partnerId,
        costPricePerCaseUsd: sourceRfqQuotes.costPricePerCaseUsd,
        caseConfig: sourceRfqQuotes.caseConfig,
        partnerName: partners.businessName,
      })
      .from(sourceRfqQuotes)
      .leftJoin(partners, eq(sourceRfqQuotes.partnerId, partners.id))
      .where(inArray(sourceRfqQuotes.id, selectedQuoteIds));

    // 4. Group quotes by partner
    const partnerQuotesMap = new Map<
      string,
      {
        partnerId: string;
        partnerName: string;
        quotes: typeof quotes;
      }
    >();

    for (const quote of quotes) {
      let partnerData = partnerQuotesMap.get(quote.partnerId);

      if (!partnerData) {
        partnerData = {
          partnerId: quote.partnerId,
          partnerName: quote.partnerName ?? 'Unknown Partner',
          quotes: [],
        };
        partnerQuotesMap.set(quote.partnerId, partnerData);
      }

      partnerData.quotes.push(quote);
    }

    // 5. Generate POs for each partner
    const generatedPOs: GeneratedPO[] = [];

    for (const partnerData of partnerQuotesMap.values()) {
      // Generate unique PO number
      const poNumber = await generatePoNumber();

      // Calculate total amount
      let totalAmountUsd = 0;
      const poItems: Array<{
        rfqItemId: string;
        quoteId: string;
        productName: string;
        producer: string | null;
        vintage: string | null;
        lwin: string | null;
        quantity: number;
        unitType: string;
        caseConfig: number | null;
        unitPriceUsd: number;
        lineTotalUsd: number;
      }> = [];

      for (const quote of partnerData.quotes) {
        const item = selectedItems.find((i) => i.selectedQuoteId === quote.id);
        if (!item) continue;

        const quantity = item.quantity ?? 1;
        const unitPriceUsd = Number(quote.costPricePerCaseUsd ?? item.finalPriceUsd ?? 0);
        const lineTotalUsd = unitPriceUsd * quantity;

        totalAmountUsd += lineTotalUsd;

        poItems.push({
          rfqItemId: item.id,
          quoteId: quote.id,
          productName: item.productName,
          producer: item.producer,
          vintage: item.vintage,
          lwin: item.lwin,
          quantity,
          unitType: item.quantityUnit === 'bottles' ? 'bottle' : 'case',
          caseConfig: item.caseConfig,
          unitPriceUsd,
          lineTotalUsd,
        });
      }

      // Create the PO
      const [po] = await db
        .insert(sourcePurchaseOrders)
        .values({
          rfqId,
          partnerId: partnerData.partnerId,
          poNumber,
          status: 'draft',
          totalAmountUsd,
          currency: 'USD',
          deliveryAddress,
          deliveryInstructions,
          paymentTerms,
          notes,
          createdBy: userId,
        })
        .returning();

      // Create PO items
      if (po && poItems.length > 0) {
        await db.insert(sourcePurchaseOrderItems).values(
          poItems.map((item) => ({
            poId: po.id,
            rfqItemId: item.rfqItemId,
            quoteId: item.quoteId,
            productName: item.productName,
            producer: item.producer,
            vintage: item.vintage,
            lwin: item.lwin,
            quantity: item.quantity,
            unitType: item.unitType,
            caseConfig: item.caseConfig,
            unitPriceUsd: item.unitPriceUsd,
            lineTotalUsd: item.lineTotalUsd,
          }))
        );

        generatedPOs.push({
          id: po.id,
          poNumber: po.poNumber,
          partnerId: partnerData.partnerId,
          partnerName: partnerData.partnerName,
          itemCount: poItems.length,
          totalAmountUsd,
        });
      }
    }

    // 6. Update RFQ status to 'po_generated'
    await db
      .update(sourceRfqs)
      .set({ status: 'po_generated' })
      .where(eq(sourceRfqs.id, rfqId));

    // Calculate grand total
    const grandTotalUsd = generatedPOs.reduce((sum, po) => sum + po.totalAmountUsd, 0);

    return {
      rfqId,
      status: 'po_generated',
      purchaseOrders: generatedPOs,
      summary: {
        totalPOs: generatedPOs.length,
        totalItems: selectedItems.length,
        grandTotalUsd,
      },
    };
  });

export default adminGeneratePurchaseOrders;
