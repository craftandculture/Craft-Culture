import { createOpenAI } from '@ai-sdk/openai';
import { TRPCError } from '@trpc/server';
import { generateObject } from 'ai';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { sourceRfqItems, sourceRfqs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import parseInputSchema from '../schemas/parseInputSchema';
import matchLwinWines from '../utils/matchLwinWines';

interface ParsedItem {
  productName: string;
  producer?: string;
  vintage?: string;
  region?: string;
  country?: string;
  bottleSize?: string;
  caseConfig?: number;
  lwin?: string;
  quantity: number;
  originalText: string;
  confidence: number;
}

/**
 * Parse CSV line handling quoted values with commas
 */
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

/**
 * Try to parse structured CSV directly (for Excel exports with known columns)
 */
const tryParseStructuredCSV = (content: string): ParsedItem[] | null => {
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return null;

  const headerLine = lines[0];
  if (!headerLine) return null;

  const headers = parseCSVLine(headerLine).map((h) => h.toLowerCase().trim());

  // Map common column names to our fields
  const columnMap: Record<string, string> = {};
  headers.forEach((header, index) => {
    const h = header.replace(/[:\s]+/g, ' ').trim();
    if (h.includes('description') || h.includes('product') || h.includes('wine') || h.includes('name')) {
      columnMap['productName'] = String(index);
    } else if (h.includes('quantity') && h.includes('case')) {
      columnMap['quantity'] = String(index);
    } else if (h === 'cases' || h === 'qty' || h === 'quantity') {
      columnMap['quantity'] = columnMap['quantity'] || String(index);
    } else if (h.includes('year') || h.includes('vintage')) {
      columnMap['vintage'] = String(index);
    } else if (h.includes('bottles') && h.includes('case')) {
      columnMap['caseConfig'] = String(index);
    } else if (h.includes('bottle') && h.includes('size')) {
      columnMap['bottleSize'] = String(index);
    } else if (h.includes('country')) {
      columnMap['country'] = String(index);
    } else if (h.includes('region') && !h.includes('sub')) {
      columnMap['region'] = String(index);
    } else if (h.includes('sub') && h.includes('region')) {
      columnMap['subRegion'] = String(index);
    } else if (h.includes('lwin')) {
      columnMap['lwin'] = String(index);
    } else if (h.includes('producer') || h.includes('winery')) {
      columnMap['producer'] = String(index);
    }
  });

  // Must have at least product name to proceed
  if (!columnMap['productName']) {
    logger.dev('CSV parsing: No product name column found');
    return null;
  }

  const items: ParsedItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const values = parseCSVLine(line);
    const productName = values[Number(columnMap['productName'])]?.trim();

    if (!productName) continue;

    const quantityStr = columnMap['quantity'] ? values[Number(columnMap['quantity'])] ?? '' : '';
    const quantity = parseInt(quantityStr, 10) || 1;

    const region = columnMap['region'] ? values[Number(columnMap['region'])]?.trim() : undefined;
    const subRegion = columnMap['subRegion'] ? values[Number(columnMap['subRegion'])]?.trim() : undefined;
    const fullRegion = [region, subRegion].filter(Boolean).join(', ') || undefined;

    const caseConfigStr = columnMap['caseConfig'] ? values[Number(columnMap['caseConfig'])] ?? '' : '';
    const caseConfig = parseInt(caseConfigStr, 10) || undefined;

    const bottleSizeStr = columnMap['bottleSize'] ? values[Number(columnMap['bottleSize'])]?.trim() ?? '' : '';
    const bottleSize = bottleSizeStr ? `${bottleSizeStr}cl` : undefined;

    items.push({
      productName,
      producer: columnMap['producer'] ? values[Number(columnMap['producer'])]?.trim() : undefined,
      vintage: columnMap['vintage'] ? values[Number(columnMap['vintage'])]?.trim() : undefined,
      region: fullRegion,
      country: columnMap['country'] ? values[Number(columnMap['country'])]?.trim() : undefined,
      bottleSize,
      caseConfig,
      lwin: columnMap['lwin'] ? values[Number(columnMap['lwin'])]?.trim() : undefined,
      quantity,
      originalText: line,
      confidence: 0.95, // High confidence for structured data
    });
  }

  return items.length > 0 ? items : null;
};

/**
 * Schema for AI-extracted wine items
 */
const extractedItemsSchema = z.object({
  items: z.array(
    z.object({
      productName: z.string().describe('Full wine product name'),
      producer: z.string().optional().describe('Wine producer/winery name'),
      vintage: z.string().optional().describe('Vintage year (e.g., "2018", "NV" for non-vintage)'),
      region: z.string().optional().describe('Wine region (e.g., Bordeaux, Napa Valley)'),
      country: z.string().optional().describe('Country of origin'),
      bottleSize: z.string().optional().describe('Bottle size (e.g., 750ml, 1.5L)'),
      caseConfig: z.number().optional().describe('Bottles per case (e.g., 6, 12)'),
      lwin: z.string().optional().describe('LWIN code if visible'),
      quantity: z.number().describe('Number of cases requested'),
      originalText: z.string().describe('Original text from source'),
      confidence: z.number().min(0).max(1).describe('Extraction confidence score'),
    }),
  ),
});

/**
 * Parse client input (email text or Excel content) into structured RFQ items
 * Uses GPT-4o to extract wine product details
 *
 * @example
 *   await trpcClient.source.admin.parseInput.mutate({
 *     rfqId: "uuid-here",
 *     inputType: "email_text",
 *     content: "We need:\n- 10 cases Opus One 2019\n- 5 cases DRC 2018\n..."
 *   });
 */
const adminParseInput = adminProcedure
  .input(parseInputSchema)
  .mutation(async ({ input }) => {
    const { rfqId, inputType, content, fileName } = input;

    // Verify RFQ exists and is in parseable state
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

    const parseableStatuses = ['draft', 'parsing'];
    if (!parseableStatuses.includes(rfq.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'RFQ is not in a state where input can be parsed',
      });
    }

    // Truncate content if too large (GPT-4o has token limits and Vercel has timeout limits)
    const MAX_CONTENT_LENGTH = 25000; // ~6,000 tokens
    let processedContent = content;
    let wasTruncated = false;

    if (content.length > MAX_CONTENT_LENGTH) {
      // For CSV/Excel, try to keep header + as many rows as possible
      const lines = content.split('\n');
      const header = lines[0] ?? '';
      const truncatedLines = [header];
      let currentLength = header.length;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line || currentLength + line.length + 1 > MAX_CONTENT_LENGTH) {
          break;
        }
        truncatedLines.push(line);
        currentLength += line.length + 1;
      }

      processedContent = truncatedLines.join('\n');
      wasTruncated = true;
    }

    // Update RFQ status to parsing
    await db
      .update(sourceRfqs)
      .set({
        status: 'parsing',
        sourceType: inputType,
        sourceFileName: fileName,
        rawInputText: content, // Store full content
      })
      .where(eq(sourceRfqs.id, rfqId));

    // For Excel/CSV files, try direct parsing first (faster and more reliable)
    if (inputType === 'excel') {
      logger.dev('Attempting direct CSV parsing for Excel file');
      const directParsedItems = tryParseStructuredCSV(content);

      if (directParsedItems && directParsedItems.length > 0) {
        logger.dev(`Direct CSV parsing successful: ${directParsedItems.length} items found`);

        // Match items to LWIN database
        const matchedItems = await matchLwinWines(directParsedItems);
        const lwinMatchCount = matchedItems.filter((item) => item.lwin).length;
        logger.dev(`LWIN matching: ${lwinMatchCount}/${matchedItems.length} items matched`);

        // Insert parsed items into database
        const itemValues = matchedItems.map((item, index) => ({
          rfqId,
          productName: item.productName,
          producer: item.producer,
          vintage: item.vintage,
          region: item.region,
          country: item.country,
          bottleSize: item.bottleSize,
          caseConfig: item.caseConfig,
          lwin: item.lwin,
          quantity: item.quantity,
          originalText: item.originalText,
          parseConfidence: item.confidence,
          sortOrder: index,
        }));

        await db.insert(sourceRfqItems).values(itemValues);

        // Update RFQ with item count and mark as ready
        await db
          .update(sourceRfqs)
          .set({
            status: 'ready_to_send',
            itemCount: matchedItems.length,
            parsedAt: new Date(),
            parsingError: null,
          })
          .where(eq(sourceRfqs.id, rfqId));

        return {
          success: true,
          message: `Successfully parsed ${matchedItems.length} items from spreadsheet (${lwinMatchCount} matched to LWIN)`,
          items: matchedItems,
        };
      }

      logger.dev('Direct CSV parsing failed, falling back to AI');
    }

    // Fall back to AI parsing for unstructured content or when direct parsing fails
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      // Reset status if AI not available
      await db
        .update(sourceRfqs)
        .set({ status: 'draft', parsingError: 'AI parsing is not configured' })
        .where(eq(sourceRfqs.id, rfqId));

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'AI parsing is not configured. OPENAI_API_KEY is not set.',
      });
    }

    const openai = createOpenAI({ apiKey: openaiKey });

    try {
      const systemPrompt = `You are an expert at extracting wine product information from client requests.
Parse the input to identify wine products the client wants to source.

For each product, extract:
- productName: Full wine name including vintage if in the name
- producer: Winery/producer name (e.g., "Opus One", "Château Margaux")
- vintage: Year only (e.g., "2019") or "NV" for non-vintage
- region: Wine region (e.g., "Napa Valley", "Bordeaux", "Burgundy")
- country: Country of origin (e.g., "USA", "France")
- bottleSize: Bottle size if specified (default to "750ml")
- caseConfig: Bottles per case if mentioned (default to 12 for Bordeaux, 6 for Burgundy)
- lwin: LWIN code if visible
- quantity: Number of CASES requested (default to 1 if not specified)
- originalText: The exact text that describes this item
- confidence: Your confidence in the extraction (0-1)

Handle various formats:
- Lists: "10 cases Opus One 2019"
- Tables: Row-by-row data
- Paragraphs: Extract products mentioned in text
- Messy input: Do your best to interpret

If you cannot confidently identify quantity, default to 1.
If vintage is unclear, leave it empty or use "NV".`;

      const truncationNote = wasTruncated
        ? '\n\nNOTE: This data has been truncated due to size. Extract all wine products from the visible rows.\n\n'
        : '\n\n';

      const userPrompt = inputType === 'excel'
        ? `Parse the following Excel/spreadsheet data and extract all wine products:${truncationNote}${processedContent}`
        : `Parse the following email text and extract all wine products:${truncationNote}${processedContent}`;

      const result = await generateObject({
        model: openai('gpt-4o'),
        schema: extractedItemsSchema,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const extractedItems = result.object.items;

      if (extractedItems.length === 0) {
        await db
          .update(sourceRfqs)
          .set({
            status: 'draft',
            parsingError: 'No wine products found in the input',
          })
          .where(eq(sourceRfqs.id, rfqId));

        return {
          success: false,
          message: 'No wine products found in the input',
          items: [],
        };
      }

      // Match items to LWIN database
      const matchedItems = await matchLwinWines(extractedItems);
      const lwinMatchCount = matchedItems.filter((item) => item.lwin).length;
      logger.dev(`LWIN matching: ${lwinMatchCount}/${matchedItems.length} items matched`);

      // Insert parsed items into database
      const itemValues = matchedItems.map((item, index) => ({
        rfqId,
        productName: item.productName,
        producer: item.producer,
        vintage: item.vintage,
        region: item.region,
        country: item.country,
        bottleSize: item.bottleSize,
        caseConfig: item.caseConfig,
        lwin: item.lwin,
        quantity: item.quantity,
        originalText: item.originalText,
        parseConfidence: item.confidence,
        sortOrder: index,
      }));

      await db.insert(sourceRfqItems).values(itemValues);

      // Update RFQ with item count and mark as ready
      await db
        .update(sourceRfqs)
        .set({
          status: 'ready_to_send',
          itemCount: matchedItems.length,
          parsedAt: new Date(),
          parsingError: null,
        })
        .where(eq(sourceRfqs.id, rfqId));

      return {
        success: true,
        message: `Successfully parsed ${matchedItems.length} items (${lwinMatchCount} matched to LWIN)`,
        items: matchedItems,
      };
    } catch (error) {
      logger.error('AI parsing failed:', error);

      // Update RFQ with error
      await db
        .update(sourceRfqs)
        .set({
          status: 'draft',
          parsingError: error instanceof Error ? error.message : 'Unknown parsing error',
        })
        .where(eq(sourceRfqs.id, rfqId));

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to parse input. Please try again or contact support.',
      });
    }
  });

export default adminParseInput;
