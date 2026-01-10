import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

import logger from '@/utils/logger';

interface RfqItem {
  id: string;
  productName: string;
  producer: string | null;
  vintage: string | null;
  quantity: number;
  sortOrder: number;
}

interface ParsedQuote {
  itemId: string;
  lineNumber: number;
  productName: string;
  quoteType: 'exact' | 'alternative' | 'not_available';
  // Which specific vintage the partner is quoting on
  // (needed when RFQ item has multiple vintages like "2018, 2016, 2013")
  quotedVintage?: string;
  costPricePerCaseUsd?: number;
  caseConfig?: string;
  availableQuantity?: number;
  leadTimeDays?: number;
  stockLocation?: string;
  notes?: string;
  notAvailableReason?: string;
  alternativeProductName?: string;
  alternativeProducer?: string;
  alternativeVintage?: string;
  alternativeCaseConfig?: number;
  alternativeReason?: string;
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
 * Try to parse structured quote CSV directly
 */
const tryParseStructuredQuoteCSV = (
  content: string,
  rfqItems: RfqItem[]
): ParsedQuote[] | null => {
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return null;

  const headerLine = lines[0];
  if (!headerLine) return null;

  const headers = parseCSVLine(headerLine).map((h) => h.toLowerCase().trim());

  // Map common column names to quote fields
  const columnMap: Record<string, number> = {};
  headers.forEach((header, index) => {
    const h = header.replace(/[:\s]+/g, ' ').trim();

    // Line number / row number
    if (h === '#' || h === 'line' || h === 'row' || h === 'no' || h === 'item') {
      columnMap['lineNumber'] = index;
    }
    // Product name for verification
    else if (
      h.includes('product') ||
      h.includes('wine') ||
      h.includes('name') ||
      h.includes('description')
    ) {
      columnMap['productName'] = index;
    }
    // Price columns
    else if (
      h.includes('price') ||
      h.includes('cost') ||
      h.includes('usd') ||
      h.includes('$') ||
      h.includes('per case')
    ) {
      columnMap['price'] = index;
    }
    // Available quantity
    else if (
      (h.includes('available') && h.includes('qty')) ||
      h.includes('avail qty') ||
      h.includes('stock')
    ) {
      columnMap['availableQuantity'] = index;
    }
    // Lead time
    else if (h.includes('lead') || h.includes('days') || h.includes('delivery')) {
      columnMap['leadTimeDays'] = index;
    }
    // Stock location
    else if (h.includes('location') || h.includes('warehouse')) {
      columnMap['stockLocation'] = index;
    }
    // Notes
    else if (h.includes('note') || h.includes('comment') || h.includes('remark')) {
      columnMap['notes'] = index;
    }
    // Status
    else if (h.includes('status') || h.includes('available') || h === 'avail') {
      columnMap['status'] = index;
    }
    // Alternative product
    else if (h.includes('alt') && h.includes('product')) {
      columnMap['altProduct'] = index;
    }
    // Quoted vintage (which vintage they're actually providing)
    else if (
      (h.includes('quoted') && h.includes('vintage')) ||
      h === 'vintage quoted' ||
      h === 'vintage offered' ||
      h === 'your vintage' ||
      (h === 'vintage' && !h.includes('alt'))
    ) {
      columnMap['quotedVintage'] = index;
    }
    // Alternative vintage
    else if (h.includes('alt') && h.includes('vintage')) {
      columnMap['altVintage'] = index;
    }
    // Alternative reason
    else if (h.includes('alt') && h.includes('reason')) {
      columnMap['altReason'] = index;
    }
    // Case config (bottles per case)
    else if (
      h.includes('case config') ||
      h.includes('caseconfig') ||
      h.includes('case size') ||
      h.includes('pack size') ||
      h.includes('bottles per case')
    ) {
      columnMap['caseConfig'] = index;
    }
    // Alternative case config
    else if (h.includes('alt') && (h.includes('case') || h.includes('config'))) {
      columnMap['altCaseConfig'] = index;
    }
  });

  // Must have at least price column or status column
  if (columnMap['price'] === undefined && columnMap['status'] === undefined) {
    logger.dev('Quote CSV parsing: No price or status column found');
    return null;
  }

  const quotes: ParsedQuote[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const values = parseCSVLine(line);

    // Determine line number (1-based from template)
    let lineNumber = i;
    if (columnMap['lineNumber'] !== undefined) {
      const parsed = parseInt(values[columnMap['lineNumber']] ?? '', 10);
      if (!isNaN(parsed)) lineNumber = parsed;
    }

    // Find matching RFQ item
    const matchingItem = rfqItems.find((item) => item.sortOrder + 1 === lineNumber);
    if (!matchingItem) {
      // Try matching by product name if line number doesn't match
      const productName =
        columnMap['productName'] !== undefined
          ? values[columnMap['productName']]?.trim()
          : '';
      const fuzzyMatch = rfqItems.find(
        (item) =>
          item.productName.toLowerCase().includes(productName?.toLowerCase() ?? '') ||
          productName?.toLowerCase().includes(item.productName.toLowerCase())
      );
      if (!fuzzyMatch) continue;
    }

    const itemId = matchingItem?.id ?? rfqItems[0]?.id ?? '';
    const productName =
      columnMap['productName'] !== undefined
        ? values[columnMap['productName']]?.trim() ?? ''
        : matchingItem?.productName ?? '';

    // Parse price (handle various formats like "$150.00", "150", "150.00 USD")
    let price: number | undefined;
    if (columnMap['price'] !== undefined) {
      const priceStr = values[columnMap['price']] ?? '';
      const cleaned = priceStr.replace(/[^0-9.]/g, '');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed) && parsed > 0) price = parsed;
    }

    // Parse status
    let quoteType: 'exact' | 'alternative' | 'not_available' = 'exact';
    let notAvailableReason: string | undefined;

    if (columnMap['status'] !== undefined) {
      const statusStr = (values[columnMap['status']] ?? '').toLowerCase().trim();
      if (
        statusStr.includes('n/a') ||
        statusStr.includes('not available') ||
        statusStr.includes('no') ||
        statusStr === 'na' ||
        statusStr === 'x'
      ) {
        quoteType = 'not_available';
        const notesIdx = columnMap['notes'];
        notAvailableReason =
          notesIdx !== undefined ? values[notesIdx]?.trim() : undefined;
      } else if (statusStr.includes('alt') || statusStr.includes('substitute')) {
        quoteType = 'alternative';
      }
    }

    // If no price and not marked as available, treat as not available
    if (price === undefined && quoteType === 'exact') {
      quoteType = 'not_available';
    }

    // Parse other fields
    const availableQuantity =
      columnMap['availableQuantity'] !== undefined
        ? parseInt(values[columnMap['availableQuantity']] ?? '', 10) || undefined
        : undefined;

    const leadTimeDays =
      columnMap['leadTimeDays'] !== undefined
        ? parseInt(values[columnMap['leadTimeDays']] ?? '', 10) || undefined
        : undefined;

    const stockLocation =
      columnMap['stockLocation'] !== undefined
        ? values[columnMap['stockLocation']]?.trim() || undefined
        : undefined;

    const notes =
      columnMap['notes'] !== undefined
        ? values[columnMap['notes']]?.trim() || undefined
        : undefined;

    // Quoted vintage (which vintage they're providing)
    const quotedVintage =
      columnMap['quotedVintage'] !== undefined
        ? values[columnMap['quotedVintage']]?.trim() || undefined
        : undefined;

    // Alternative fields
    const alternativeProductName =
      columnMap['altProduct'] !== undefined
        ? values[columnMap['altProduct']]?.trim() || undefined
        : undefined;

    const alternativeVintage =
      columnMap['altVintage'] !== undefined
        ? values[columnMap['altVintage']]?.trim() || undefined
        : undefined;

    const alternativeReason =
      columnMap['altReason'] !== undefined
        ? values[columnMap['altReason']]?.trim() || undefined
        : undefined;

    // Case config fields
    const caseConfig =
      columnMap['caseConfig'] !== undefined
        ? values[columnMap['caseConfig']]?.trim() || undefined
        : undefined;

    const altCaseConfigStr =
      columnMap['altCaseConfig'] !== undefined
        ? values[columnMap['altCaseConfig']]?.trim()
        : undefined;
    const alternativeCaseConfig = altCaseConfigStr
      ? parseInt(altCaseConfigStr, 10) || undefined
      : undefined;

    quotes.push({
      itemId,
      lineNumber,
      productName,
      quoteType,
      quotedVintage,
      costPricePerCaseUsd: price,
      caseConfig,
      availableQuantity,
      leadTimeDays,
      stockLocation,
      notes,
      notAvailableReason,
      alternativeProductName,
      alternativeVintage,
      alternativeCaseConfig,
      alternativeReason,
      confidence: 0.9,
    });
  }

  return quotes.length > 0 ? quotes : null;
};

/**
 * Schema for AI-extracted quotes
 */
const extractedQuotesSchema = z.object({
  quotes: z.array(
    z.object({
      lineNumber: z.number().describe('Line number from the template (1-based)'),
      productName: z.string().describe('Product name for verification'),
      quoteType: z
        .enum(['exact', 'alternative', 'not_available'])
        .describe('Type of quote response'),
      quotedVintage: z
        .string()
        .optional()
        .describe(
          'Which specific vintage the partner is quoting on (e.g., if RFQ asks for "2018, 2016, 2013" and partner quotes "2018")'
        ),
      costPricePerCaseUsd: z
        .number()
        .optional()
        .describe('Price per case in USD (extract number only)'),
      caseConfig: z
        .string()
        .optional()
        .describe('Case configuration (e.g., "6", "12", "6x75cl")'),
      availableQuantity: z.number().optional().describe('Available quantity in cases'),
      leadTimeDays: z.number().optional().describe('Lead time in days'),
      stockLocation: z.string().optional().describe('Stock location/warehouse'),
      notes: z.string().optional().describe('Any notes or comments'),
      notAvailableReason: z
        .string()
        .optional()
        .describe('Reason if not available'),
      alternativeProductName: z
        .string()
        .optional()
        .describe('Alternative product name if proposing substitute'),
      alternativeProducer: z
        .string()
        .optional()
        .describe('Alternative producer if proposing substitute'),
      alternativeVintage: z
        .string()
        .optional()
        .describe('Alternative vintage if proposing substitute'),
      alternativeCaseConfig: z
        .number()
        .optional()
        .describe('Alternative case configuration (bottles per case)'),
      alternativeReason: z
        .string()
        .optional()
        .describe('Reason for proposing alternative'),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .describe('Confidence in extraction accuracy'),
    })
  ),
});

/**
 * Parse partner quote response Excel using AI
 *
 * @example
 *   const result = await parseQuoteExcel(csvContent, rfqItems);
 *   // result.quotes contains parsed quote data matched to RFQ items
 */
const parseQuoteExcel = async (
  content: string,
  rfqItems: RfqItem[]
): Promise<{ quotes: ParsedQuote[]; message: string }> => {
  // Create a reference list of RFQ items for context
  const itemsContext = rfqItems
    .map(
      (item, idx) =>
        `Line ${idx + 1}: ${item.productName}${item.producer ? ` by ${item.producer}` : ''}${item.vintage ? ` (${item.vintage})` : ''} - ${item.quantity} cases`
    )
    .join('\n');

  // Try direct CSV parsing first
  logger.dev('Attempting direct CSV parsing for quote response');
  const directParsedQuotes = tryParseStructuredQuoteCSV(content, rfqItems);

  if (directParsedQuotes && directParsedQuotes.length > 0) {
    logger.dev(`Direct CSV parsing successful: ${directParsedQuotes.length} quotes found`);
    return {
      quotes: directParsedQuotes,
      message: `Parsed ${directParsedQuotes.length} quotes from spreadsheet`,
    };
  }

  logger.dev('Direct CSV parsing failed, falling back to AI');

  // Fall back to AI parsing
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    throw new Error('AI parsing is not configured. OPENAI_API_KEY is not set.');
  }

  const openai = createOpenAI({ apiKey: openaiKey });

  const systemPrompt = `You are an expert at extracting wine pricing quotes from partner responses.

The partner is responding to an RFQ (Request for Quote) with these items:
${itemsContext}

Parse the partner's response to extract their quote for each item.

For each item extract:
- lineNumber: Match to the RFQ line number (1-based)
- productName: For verification
- quoteType: 'exact' if they can supply the exact product, 'alternative' if proposing substitute, 'not_available' if they cannot supply
- quotedVintage: IMPORTANT - if the RFQ item has multiple vintages (e.g., "2018, 2016, 2013"), extract which specific vintage the partner is actually quoting on
- costPricePerCaseUsd: Price per case in USD (extract just the number, e.g., "$150.00/case" -> 150)
- caseConfig: Case configuration (e.g., "6", "12", "6x75cl") - bottles per case
- availableQuantity: How many cases they have available
- leadTimeDays: Delivery time in days
- stockLocation: Where the stock is located
- notes: Any additional notes
- notAvailableReason: Why they can't supply (if not_available)
- alternativeProductName/Producer/Vintage/CaseConfig/Reason: If proposing alternative
- confidence: Your confidence in the extraction (0-1)

Handle various formats:
- Structured spreadsheets with columns
- Messy data with prices like "$150", "150 USD", "150.00/case"
- Status indicators like "Y/N", "Available/NA", checkmarks, "X" for not available
- Empty cells mean not available unless there's a price

Match quotes to RFQ items by:
1. Line number if present
2. Product name similarity
3. Position in list`;

  const userPrompt = `Parse the following partner quote response and extract pricing data for each RFQ item:

${content}`;

  const result = await generateObject({
    model: openai('gpt-4o'),
    schema: extractedQuotesSchema,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const extractedQuotes = result.object.quotes;

  // Match extracted quotes to RFQ items by line number
  const matchedQuotes: ParsedQuote[] = extractedQuotes.map((quote) => {
    // Find matching RFQ item by line number (1-based in template)
    const matchingItem = rfqItems.find(
      (item) => item.sortOrder + 1 === quote.lineNumber
    );

    // Fallback to fuzzy product name matching
    const itemId =
      matchingItem?.id ??
      rfqItems.find(
        (item) =>
          item.productName
            .toLowerCase()
            .includes(quote.productName.toLowerCase()) ||
          quote.productName.toLowerCase().includes(item.productName.toLowerCase())
      )?.id ??
      rfqItems[0]?.id ??
      '';

    return {
      itemId,
      lineNumber: quote.lineNumber,
      productName: quote.productName,
      quoteType: quote.quoteType,
      quotedVintage: quote.quotedVintage,
      costPricePerCaseUsd: quote.costPricePerCaseUsd,
      caseConfig: quote.caseConfig,
      availableQuantity: quote.availableQuantity,
      leadTimeDays: quote.leadTimeDays,
      stockLocation: quote.stockLocation,
      notes: quote.notes,
      notAvailableReason: quote.notAvailableReason,
      alternativeProductName: quote.alternativeProductName,
      alternativeProducer: quote.alternativeProducer,
      alternativeVintage: quote.alternativeVintage,
      alternativeCaseConfig: quote.alternativeCaseConfig,
      alternativeReason: quote.alternativeReason,
      confidence: quote.confidence,
    };
  });

  return {
    quotes: matchedQuotes,
    message: `AI parsed ${matchedQuotes.length} quotes`,
  };
};

export default parseQuoteExcel;

export type { ParsedQuote, RfqItem };
