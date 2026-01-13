import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  partners,
  sourceRfqItems,
  sourceRfqPartners,
  sourceRfqs,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import excelToCSV from '../utils/excelToCSV';
import parseQuoteExcel from '../utils/parseQuoteExcel';

const adminParseQuoteExcelSchema = z.object({
  rfqId: z.string().uuid(),
  partnerId: z.string().uuid(),
  /** Base64-encoded Excel file data OR plain CSV string */
  content: z
    .string()
    .transform((val) => val.replace(/\x00/g, ''))
    .pipe(z.string().min(1, 'Content is required')),
  /** Whether the content is base64-encoded Excel (true) or plain CSV (false) */
  isBase64Excel: z.boolean().default(false),
  fileName: z.string().optional(),
});

/**
 * Parse partner's quote response Excel on their behalf
 *
 * Admin can upload an Excel file received from a partner (via email, etc.)
 * and parse it to submit quotes on the partner's behalf.
 *
 * @example
 *   const result = await trpcClient.source.admin.parseQuoteExcel.mutate({
 *     rfqId: "uuid",
 *     partnerId: "uuid",
 *     content: csvContent,
 *     fileName: "partner_response.xlsx"
 *   });
 */
const adminParseQuoteExcel = adminProcedure
  .input(adminParseQuoteExcelSchema)
  .mutation(async ({ input }) => {
    const { rfqId, partnerId, content, isBase64Excel, fileName } = input;

    // Verify RFQ exists
    const [rfq] = await db
      .select()
      .from(sourceRfqs)
      .where(eq(sourceRfqs.id, rfqId));

    if (!rfq) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'RFQ not found',
      });
    }

    // Verify partner exists and is a wine partner
    const [partner] = await db
      .select()
      .from(partners)
      .where(eq(partners.id, partnerId));

    if (!partner) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Partner not found',
      });
    }

    if (partner.type !== 'wine_partner') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Partner is not a wine partner',
      });
    }

    // Get partner assignments for this RFQ
    const partnerAssignments = await db
      .select()
      .from(sourceRfqPartners)
      .where(eq(sourceRfqPartners.rfqId, rfqId));

    const isAssigned = partnerAssignments.some((a) => a.partnerId === partnerId);

    if (!isAssigned) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Partner is not assigned to this RFQ. Please assign them first.',
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
      // Convert Excel to CSV if needed (server-side parsing with exceljs for security)
      let csvContent = content;
      if (isBase64Excel) {
        const buffer = Buffer.from(content, 'base64');
        csvContent = await excelToCSV(buffer);
      }

      // Parse the CSV content
      const result = await parseQuoteExcel(csvContent, items);

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
        partnerId,
        partnerName: partner.businessName,
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
      logger.error('Admin quote Excel parsing failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        rfqId,
        partnerId,
      });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to parse quote file. Please ensure the file is a valid Excel or CSV format.',
      });
    }
  });

export default adminParseQuoteExcel;
