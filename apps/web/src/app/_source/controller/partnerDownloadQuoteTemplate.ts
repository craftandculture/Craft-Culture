import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import { z } from 'zod';

import db from '@/database/client';
import {
  sourceRfqItems,
  sourceRfqPartners,
  sourceRfqs,
} from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

const downloadQuoteTemplateSchema = z.object({
  rfqId: z.string().uuid(),
});

/**
 * Generate an Excel template for partner to fill in their quote response
 *
 * Returns a base64-encoded Excel file with:
 * - Pre-filled RFQ item details (read-only columns)
 * - Empty columns for partner to fill in prices and availability
 *
 * @example
 *   const template = await trpcClient.source.partner.downloadQuoteTemplate.query({
 *     rfqId: "uuid"
 *   });
 *   // template.data contains base64-encoded Excel file
 */
const partnerDownloadQuoteTemplate = winePartnerProcedure
  .input(downloadQuoteTemplateSchema)
  .query(async ({ input, ctx }) => {
    const { rfqId } = input;
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

    // Fetch RFQ items
    const items = await db
      .select({
        id: sourceRfqItems.id,
        productName: sourceRfqItems.productName,
        producer: sourceRfqItems.producer,
        vintage: sourceRfqItems.vintage,
        region: sourceRfqItems.region,
        quantity: sourceRfqItems.quantity,
        bottleSize: sourceRfqItems.bottleSize,
        caseConfig: sourceRfqItems.caseConfig,
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

    // Build worksheet data
    const headers = [
      '#',
      'Product',
      'Producer',
      'Vintage',
      'Region',
      'Qty Requested',
      'Bottle Size',
      'Case Config',
      '--- YOUR RESPONSE ---',
      'Your Price (USD/case)',
      'Available Qty',
      'Lead Time (days)',
      'Stock Location',
      'Notes',
      'Status',
      'Alt Product',
      'Alt Vintage',
      'Alt Reason',
    ];

    const rows = items.map((item, idx) => [
      idx + 1, // Line number
      item.productName,
      item.producer ?? '',
      item.vintage ?? '',
      item.region ?? '',
      item.quantity,
      item.bottleSize ?? '750ml',
      item.caseConfig ?? 12,
      '', // Separator
      '', // Price - partner fills
      '', // Available qty - partner fills
      '', // Lead time - partner fills
      '', // Stock location - partner fills
      '', // Notes - partner fills
      'Available', // Default status - partner can change to "Not Available" or "Alternative"
      '', // Alt product - partner fills if alternative
      '', // Alt vintage - partner fills if alternative
      '', // Alt reason - partner fills if alternative
    ]);

    // Create workbook
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 4 }, // #
      { wch: 40 }, // Product
      { wch: 20 }, // Producer
      { wch: 8 }, // Vintage
      { wch: 15 }, // Region
      { wch: 12 }, // Qty Requested
      { wch: 10 }, // Bottle Size
      { wch: 10 }, // Case Config
      { wch: 18 }, // Separator
      { wch: 18 }, // Your Price
      { wch: 12 }, // Available Qty
      { wch: 14 }, // Lead Time
      { wch: 15 }, // Stock Location
      { wch: 25 }, // Notes
      { wch: 12 }, // Status
      { wch: 30 }, // Alt Product
      { wch: 10 }, // Alt Vintage
      { wch: 25 }, // Alt Reason
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Quote Response');

    // Add instructions sheet
    const instructionsData = [
      ['QUOTE RESPONSE TEMPLATE'],
      [''],
      [`RFQ: ${assignment.rfq.name}`],
      [`Reference: ${assignment.rfq.rfqNumber}`],
      [`Due: ${assignment.rfq.responseDeadline ? new Date(assignment.rfq.responseDeadline).toLocaleDateString() : 'No deadline'}`],
      [''],
      ['INSTRUCTIONS:'],
      ['1. Fill in your prices in the "Your Price (USD/case)" column'],
      ['2. Enter available quantity and lead time'],
      ['3. For items you cannot supply, change Status to "Not Available"'],
      ['4. To propose an alternative, change Status to "Alternative" and fill Alt columns'],
      ['5. Upload the completed file back to the platform'],
      [''],
      ['STATUS OPTIONS:'],
      ['- Available: You can supply the exact product at the price specified'],
      ['- Not Available: You cannot supply this product (add reason in Notes)'],
      ['- Alternative: You are proposing a substitute product'],
      [''],
      ['NOTE: Columns A-H are read-only reference. Fill columns J onwards.'],
    ];

    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
    instructionsSheet['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

    // Generate Excel file as base64
    const excelBuffer = XLSX.write(workbook, {
      type: 'base64',
      bookType: 'xlsx',
    });

    const fileName = `Quote_Response_${assignment.rfq.rfqNumber}.xlsx`;

    return {
      data: excelBuffer,
      fileName,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      itemCount: items.length,
    };
  });

export default partnerDownloadQuoteTemplate;
