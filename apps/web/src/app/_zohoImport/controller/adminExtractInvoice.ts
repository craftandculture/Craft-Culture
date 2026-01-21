import { createOpenAI } from '@ai-sdk/openai';
import { TRPCError } from '@trpc/server';
import { type CoreMessage, generateObject } from 'ai';
import { sql } from 'drizzle-orm';
import pdfParse from 'pdf-parse';
import { pdf } from 'pdf-to-img';
import { z } from 'zod';

import db from '@/database/client';
import { lwinWines } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import extractInvoiceSchema from '../schemas/extractInvoiceSchema';
import type { ZohoItem } from '../schemas/zohoItemSchema';
import determineHsCode from '../utils/determineHsCode';

/**
 * Schema for AI extraction output
 */
const extractedInvoiceSchema = z.object({
  supplierName: z.string().optional().describe('Supplier/vendor name from invoice header'),
  invoiceNumber: z.string().optional().describe('Invoice number'),
  invoiceDate: z.string().optional().describe('Invoice date'),
  lineItems: z
    .array(
      z.object({
        productName: z.string().describe('Full wine product name including producer'),
        vintage: z.string().optional().describe('Vintage year (4 digits)'),
        quantity: z.number().describe('Number of cases'),
        caseConfig: z.number().optional().describe('Bottles per case (e.g., 6 or 12)'),
        bottleSize: z.number().optional().describe('Bottle size in ml (e.g., 750)'),
        lwinCode: z.string().optional().describe('LWIN code if present in invoice'),
      }),
    )
    .describe('Line items from the invoice'),
});

/**
 * Match a single item to the LWIN database
 */
const matchLwin = async (productName: string, _vintage: string | null) => {
  // Remove vintage from product name for better matching
  const nameWithoutVintage = productName.replace(/\b(19|20)\d{2}\b/g, '').trim();

  try {
    const results = await db
      .select({
        lwin: lwinWines.lwin,
        displayName: lwinWines.displayName,
        producerName: lwinWines.producerName,
        wine: lwinWines.wine,
        country: lwinWines.country,
        region: lwinWines.region,
        type: lwinWines.type,
        colour: lwinWines.colour,
        subType: lwinWines.subType,
        similarity: sql<number>`similarity(${lwinWines.displayName}, ${nameWithoutVintage})`,
      })
      .from(lwinWines)
      .where(sql`similarity(${lwinWines.displayName}, ${nameWithoutVintage}) > 0.25`)
      .orderBy(sql`similarity(${lwinWines.displayName}, ${nameWithoutVintage}) DESC`)
      .limit(1);

    if (results.length === 0 || !results[0]) {
      return null;
    }

    return results[0];
  } catch (error) {
    logger.warn('[ZohoImport] LWIN match failed, trying ILIKE fallback', { error, productName });

    // Fallback to ILIKE
    try {
      const searchPattern = `%${nameWithoutVintage.replace(/\s+/g, '%')}%`;
      const results = await db
        .select({
          lwin: lwinWines.lwin,
          displayName: lwinWines.displayName,
          producerName: lwinWines.producerName,
          wine: lwinWines.wine,
          country: lwinWines.country,
          region: lwinWines.region,
          type: lwinWines.type,
          colour: lwinWines.colour,
          subType: lwinWines.subType,
        })
        .from(lwinWines)
        .where(sql`${lwinWines.displayName} ILIKE ${searchPattern}`)
        .limit(1);

      if (results.length === 0 || !results[0]) {
        return null;
      }

      return { ...results[0], similarity: 0.5 };
    } catch {
      return null;
    }
  }
};

/**
 * Generate LWIN-18 format SKU
 */
const generateSku = (
  lwin7: string | null,
  vintage: string | null,
  caseConfig: number,
  bottleSizeMl: number,
): string => {
  const lwinPart = lwin7?.padStart(7, '0') ?? '0000000';
  const vintagePart = vintage ?? '1000'; // 1000 = NV indicator
  const caseConfigPart = String(caseConfig).padStart(2, '0');
  const bottleSizePart = String(bottleSizeMl).padStart(5, '0');

  return `${lwinPart}${vintagePart}${caseConfigPart}${bottleSizePart}`;
};

/**
 * Extract wine items from supplier invoice and match to LWIN database
 *
 * Uses GPT-4o vision to extract structured line items from PDF/image invoices,
 * then matches each item against the LWIN database for enrichment.
 */
const adminExtractInvoice = adminProcedure.input(extractInvoiceSchema).mutation(async ({ input }) => {
  const { file: rawFile, fileType, supplierName } = input;

  // Strip data URL prefix if present
  const file = rawFile.includes(',') ? rawFile.split(',')[1] ?? rawFile : rawFile;

  const openaiKey = process.env.OPENAI_API_KEY;

  logger.info('[ZohoImport] Starting invoice extraction', {
    hasKey: !!openaiKey,
    fileType,
    supplierName,
  });

  if (!openaiKey) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'AI extraction is not configured. OPENAI_API_KEY environment variable is not set.',
    });
  }

  const openai = createOpenAI({ apiKey: openaiKey });

  const systemPrompt = `You are a precise OCR system that extracts wine product data from supplier invoices.

ABSOLUTE RULES:
1. TRANSCRIBE ONLY - Copy product names EXACTLY as they appear, character by character.
2. ZERO INVENTION - Never guess or invent product names. If unreadable, skip the item.
3. Extract ALL line items from the invoice - count to ensure completeness.
4. Wine products typically include: Producer name, wine type, region/appellation, vintage year.
5. Case configuration is usually noted as "6x75cl" or "12x750ml" - extract the number of bottles.
6. If LWIN/SKU codes are present, extract them.
7. Dates should be ISO format (YYYY-MM-DD).

Focus on extracting:
- Product names (full description including producer)
- Vintage year (4 digits, e.g., 2019)
- Quantity (number of cases)
- Case configuration (bottles per case: 6 or 12)
- Bottle size (in ml: 375, 750, 1500, etc.)`;

  try {
    let extractedData: z.infer<typeof extractedInvoiceSchema>;

    if (fileType.startsWith('image/')) {
      const messages: CoreMessage[] = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract all wine line items from this supplier invoice image.

For each product, extract:
- Full product name (producer + wine + region)
- Vintage year
- Quantity (cases)
- Case configuration (bottles per case)
- Bottle size (ml)
- LWIN code if visible

This is a TRANSCRIPTION task. Copy product names exactly as written.`,
            },
            {
              type: 'image',
              image: file,
            },
          ],
        },
      ];

      const result = await generateObject({
        model: openai('gpt-4o'),
        schema: extractedInvoiceSchema,
        system: systemPrompt,
        messages,
      });

      extractedData = result.object;
    } else if (fileType === 'application/pdf') {
      const pdfBuffer = Buffer.from(file, 'base64');
      let pdfText = '';

      try {
        const pdfData = await pdfParse(pdfBuffer);
        pdfText = pdfData.text;

        logger.info('[ZohoImport] PDF text extracted', {
          pages: pdfData.numpages,
          textLength: pdfText.length,
        });
      } catch (parseError) {
        logger.warn('[ZohoImport] pdf-parse failed', {
          error: parseError instanceof Error ? parseError.message : 'Unknown error',
        });
      }

      if (pdfText && pdfText.trim().length >= 50) {
        // Digital PDF with extractable text - use text extraction
        const result = await generateObject({
          model: openai('gpt-4o'),
          schema: extractedInvoiceSchema,
          system: systemPrompt,
          maxTokens: 16384,
          prompt: `Extract all wine line items from this supplier invoice.

For each product, extract:
- Full product name (producer + wine + region)
- Vintage year
- Quantity (cases)
- Case configuration (bottles per case, default 6 for Burgundy, 12 for Bordeaux)
- Bottle size (ml, default 750)
- LWIN code if visible

--- INVOICE TEXT ---
${pdfText}
--- END INVOICE ---`,
        });

        extractedData = result.object;
      } else {
        // Scanned PDF or no extractable text - convert to images and use vision
        logger.info('[ZohoImport] PDF has no extractable text, converting to images for vision mode');

        // Convert PDF pages to images
        const pdfImages: string[] = [];
        try {
          const document = await pdf(pdfBuffer, { scale: 2.0 });
          for await (const image of document) {
            // image is a Buffer with PNG data
            pdfImages.push(image.toString('base64'));
          }
          logger.info('[ZohoImport] PDF converted to images', { pageCount: pdfImages.length });
        } catch (convertError) {
          logger.error('[ZohoImport] PDF to image conversion failed', {
            error: convertError instanceof Error ? convertError.message : 'Unknown error',
          });
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'Could not process this PDF. Please try exporting it as a PNG/JPG image and uploading that instead.',
          });
        }

        if (pdfImages.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'PDF appears to be empty. Please check the file and try again.',
          });
        }

        // Build message content with all page images
        const imageContent: CoreMessage['content'] = [
          {
            type: 'text',
            text: `Extract all wine line items from this supplier invoice/packing list (${pdfImages.length} page${pdfImages.length > 1 ? 's' : ''}).

For each product, extract:
- Full product name (producer + wine + region)
- Vintage year (4 digits like 2018, 2020, etc. NOT lot numbers)
- Quantity (number of CASES, not bottles)
- Case configuration (bottles per case: 3, 6, or 12)
- Bottle size in ml (750 for standard bottles, 1500 for magnums)
- LWIN code if visible

IMPORTANT:
- "Magnum" or "150 cl" means 1500ml bottle size
- Count CASES not bottles (e.g., "3 cases of 12 bottles" = quantity 3)
- "Lot 05" is NOT a vintage - leave vintage empty for lot-numbered wines
- "wb" = wooden box, "ct" = cardboard - these indicate case packaging, not quantity

This is a TRANSCRIPTION task. Copy product names exactly as written.`,
          },
          // Add each page as an image (limit to first 5 pages to avoid token limits)
          ...pdfImages.slice(0, 5).map((img) => ({
            type: 'image' as const,
            image: img,
          })),
        ];

        const messages: CoreMessage[] = [
          {
            role: 'user',
            content: imageContent,
          },
        ];

        const result = await generateObject({
          model: openai('gpt-4o'),
          schema: extractedInvoiceSchema,
          system: systemPrompt,
          messages,
        });

        extractedData = result.object;
      }
    } else {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Unsupported file type: ${fileType}`,
      });
    }

    logger.info('[ZohoImport] AI extraction complete', {
      itemCount: extractedData.lineItems?.length ?? 0,
      detectedSupplier: extractedData.supplierName,
    });

    // Process each item: match LWIN, enrich data, generate SKU
    const items: ZohoItem[] = [];
    let matchedCount = 0;

    for (const lineItem of extractedData.lineItems ?? []) {
      const vintage = lineItem.vintage ?? null;
      const caseConfig = lineItem.caseConfig ?? 6;
      const bottleSize = lineItem.bottleSize ?? 750;

      // Try to match LWIN
      const lwinMatch = await matchLwin(lineItem.productName, vintage);
      const hasMatch = lwinMatch !== null && (lwinMatch.similarity ?? 0) >= 0.3;

      if (hasMatch) {
        matchedCount++;
      }

      // Determine HS code based on wine type
      const hsCode = determineHsCode(
        lwinMatch?.type ?? null,
        lwinMatch?.colour ?? null,
        lwinMatch?.subType ?? null,
      );

      // Generate SKU
      const sku = generateSku(lwinMatch?.lwin ?? null, vintage, caseConfig, bottleSize);

      items.push({
        id: crypto.randomUUID(),
        originalText: lineItem.productName,
        productName: lineItem.productName,
        vintage,
        bottleSize,
        caseConfig,
        quantity: lineItem.quantity,
        lwin7: lwinMatch?.lwin ?? null,
        lwinDisplayName: lwinMatch?.displayName ?? null,
        matchConfidence: lwinMatch?.similarity ?? 0,
        country: lwinMatch?.country ?? null,
        region: lwinMatch?.region ?? null,
        wineType: lwinMatch?.type ?? null,
        wineColour: lwinMatch?.colour ?? null,
        subType: lwinMatch?.subType ?? null,
        hsCode,
        sku,
        hasLwinMatch: hasMatch,
        needsReview: !hasMatch || (lwinMatch?.similarity ?? 0) < 0.5,
      });
    }

    logger.info('[ZohoImport] LWIN matching complete', {
      total: items.length,
      matched: matchedCount,
      unmatched: items.length - matchedCount,
    });

    return {
      success: true,
      supplierName: extractedData.supplierName ?? supplierName,
      invoiceNumber: extractedData.invoiceNumber ?? null,
      invoiceDate: extractedData.invoiceDate ?? null,
      items,
      stats: {
        total: items.length,
        matched: matchedCount,
        unmatched: items.length - matchedCount,
        needsReview: items.filter((i) => i.needsReview).length,
      },
    };
  } catch (error) {
    logger.error('[ZohoImport] Extraction failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to extract invoice: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});

export default adminExtractInvoice;
