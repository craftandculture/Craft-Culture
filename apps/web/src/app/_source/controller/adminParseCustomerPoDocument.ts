import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { sourceCustomerPoItems, sourceCustomerPos } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import excelToCSV from '../utils/excelToCSV';
import parseCustomerPoExcel from '../utils/parseCustomerPoExcel';

const parseDocumentSchema = z.object({
  customerPoId: z.string().uuid(),
  fileContent: z.string().describe('Base64 encoded Excel/CSV content'),
  fileName: z.string().optional(),
  autoSave: z.boolean().default(true).describe('Automatically save parsed items to the PO'),
});

/**
 * Parse customer PO document and extract line items
 *
 * @example
 *   const result = await trpcClient.source.admin.customerPo.parseDocument.mutate({
 *     customerPoId: "uuid",
 *     fileContent: "base64...",
 *     autoSave: true,
 *   });
 */
const adminParseCustomerPoDocument = adminProcedure
  .input(parseDocumentSchema)
  .mutation(async ({ input }) => {
    try {
      // Verify the customer PO exists
      const [customerPo] = await db
        .select()
        .from(sourceCustomerPos)
        .where(eq(sourceCustomerPos.id, input.customerPoId))
        .limit(1);

      if (!customerPo) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer PO not found',
        });
      }

      // Decode base64 content
      const buffer = Buffer.from(input.fileContent, 'base64');

      // Convert Excel to CSV
      let csvContent: string;
      try {
        csvContent = await excelToCSV(buffer);
      } catch {
        // Try treating as plain CSV
        csvContent = buffer.toString('utf-8');
      }

      // Parse the CSV content
      const { items, message } = await parseCustomerPoExcel(csvContent);

      if (items.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No items could be extracted from the document. Please check the file format.',
        });
      }

      // Calculate stats
      const stats = {
        total: items.length,
        withPrice: items.filter((i) => i.sellPricePerCaseUsd !== undefined).length,
        withLwin: items.filter((i) => i.lwin).length,
        highConfidence: items.filter((i) => i.confidence >= 0.8).length,
        lowConfidence: items.filter((i) => i.confidence < 0.5).length,
      };

      // Auto-save items if requested
      if (input.autoSave && items.length > 0) {
        // Insert items in order
        const itemsToInsert = items.map((item, index) => ({
          customerPoId: input.customerPoId,
          productName: item.productName,
          producer: item.producer || null,
          vintage: item.vintage || null,
          region: item.region || null,
          quantity: item.quantity,
          sellPricePerCaseUsd: item.sellPricePerCaseUsd ?? null,
          sellLineTotalUsd: item.sellPricePerCaseUsd
            ? item.sellPricePerCaseUsd * item.quantity
            : null,
          bottleSize: item.bottleSize || null,
          caseConfig: item.caseConfig ? parseInt(item.caseConfig, 10) : null,
          lwin: item.lwin || null,
          notes: item.notes || null,
          sortOrder: index,
          status: 'pending_match' as const,
          matchSource: null,
        }));

        await db.insert(sourceCustomerPoItems).values(itemsToInsert);

        // Update customer PO status and item count
        await db
          .update(sourceCustomerPos)
          .set({
            status: 'matching',
            itemCount: items.length,
            parsedAt: new Date(),
          })
          .where(eq(sourceCustomerPos.id, input.customerPoId));
      }

      return {
        items,
        stats,
        message,
        saved: input.autoSave,
      };
    } catch (error) {
      logger.error('Error parsing customer PO document:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to parse document. Please try again.',
      });
    }
  });

export default adminParseCustomerPoDocument;
