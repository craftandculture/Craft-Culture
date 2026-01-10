import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  sourceRfqItems,
  sourceRfqPartners,
  sourceRfqs,
} from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

import parseQuoteExcel from '../utils/parseQuoteExcel';

const parseQuoteExcelSchema = z.object({
  rfqId: z.string().uuid(),
  content: z
    .string()
    .transform((val) => val.replace(/\x00/g, ''))
    .pipe(z.string().min(1, 'Content is required')),
  fileName: z.string().optional(),
});

/**
 * Parse partner's uploaded Excel quote response using AI
 *
 * Returns parsed quotes for review before submission.
 * Partner can then edit and submit using the regular submitQuotes endpoint.
 *
 * @example
 *   const result = await trpcClient.source.partner.parseQuoteExcel.mutate({
 *     rfqId: "uuid",
 *     content: csvContent,
 *     fileName: "response.xlsx"
 *   });
 *   // result.quotes contains parsed data ready for review
 */
const partnerParseQuoteExcel = winePartnerProcedure
  .input(parseQuoteExcelSchema)
  .mutation(async ({ input, ctx }) => {
    const { rfqId, content, fileName } = input;
    const partnerId = ctx.partnerId;

    // Verify partner is assigned to this RFQ
    const [assignment] = await db
      .select({
        assignment: sourceRfqPartners,
        rfq: sourceRfqs,
      })
      .from(sourceRfqPartners)
      .innerJoin(sourceRfqs, eq(sourceRfqPartners.rfqId, sourceRfqs.id))
      .where(
        and(
          eq(sourceRfqPartners.rfqId, rfqId),
          eq(sourceRfqPartners.partnerId, partnerId)
        )
      );

    if (!assignment) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'RFQ not found or not assigned to you',
      });
    }

    // Check RFQ is still accepting quotes
    const quotableStatuses = ['sent', 'collecting'];
    if (!quotableStatuses.includes(assignment.rfq.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'RFQ is no longer accepting quotes',
      });
    }

    // Check deadline
    if (
      assignment.rfq.responseDeadline &&
      new Date() > assignment.rfq.responseDeadline
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'The deadline for this RFQ has passed',
      });
    }

    // Fetch RFQ items
    const items = await db
      .select({
        id: sourceRfqItems.id,
        productName: sourceRfqItems.productName,
        producer: sourceRfqItems.producer,
        vintage: sourceRfqItems.vintage,
        quantity: sourceRfqItems.quantity,
        sortOrder: sourceRfqItems.sortOrder,
      })
      .from(sourceRfqItems)
      .where(eq(sourceRfqItems.rfqId, rfqId))
      .orderBy(sourceRfqItems.sortOrder);

    if (items.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'RFQ has no items',
      });
    }

    try {
      // Parse the Excel content
      const result = await parseQuoteExcel(content, items);

      // Calculate stats
      const exactCount = result.quotes.filter(
        (q) => q.quoteType === 'exact'
      ).length;
      const altCount = result.quotes.filter(
        (q) => q.quoteType === 'alternative'
      ).length;
      const naCount = result.quotes.filter(
        (q) => q.quoteType === 'not_available'
      ).length;
      const highConfidenceCount = result.quotes.filter(
        (q) => q.confidence >= 0.8
      ).length;
      const lowConfidenceCount = result.quotes.filter(
        (q) => q.confidence < 0.8
      ).length;

      return {
        success: true,
        message: result.message,
        fileName,
        quotes: result.quotes,
        stats: {
          total: result.quotes.length,
          exact: exactCount,
          alternatives: altCount,
          notAvailable: naCount,
          highConfidence: highConfidenceCount,
          lowConfidence: lowConfidenceCount,
        },
        rfqItemCount: items.length,
      };
    } catch (error) {
      console.error('Quote Excel parsing failed:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to parse quote file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  });

export default partnerParseQuoteExcel;
