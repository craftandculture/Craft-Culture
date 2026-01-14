import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

import logger from '@/utils/logger';

interface ParsedPoItem {
  lineNumber: number;
  productName: string;
  producer?: string;
  vintage?: string;
  region?: string;
  quantity: number;
  sellPricePerCaseUsd?: number;
  bottleSize?: string;
  caseConfig?: string;
  lwin?: string;
  notes?: string;
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
 * Try to parse structured PO CSV directly
 */
const tryParseStructuredPoCSV = (content: string): ParsedPoItem[] | null => {
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return null;

  const headerLine = lines[0];
  if (!headerLine) return null;

  const headers = parseCSVLine(headerLine).map((h) => h.toLowerCase().trim());

  // Map common column names to PO fields
  const columnMap: Record<string, number> = {};
  headers.forEach((header, index) => {
    const h = header.replace(/[:\s]+/g, ' ').trim();

    // Line number
    if (h === '#' || h === 'line' || h === 'row' || h === 'no' || h === 'item') {
      columnMap['lineNumber'] = index;
    }
    // Product name
    else if (h.includes('product') || h.includes('wine') || h.includes('name') || h.includes('description')) {
      columnMap['productName'] = index;
    }
    // Producer
    else if (h.includes('producer') || h.includes('winery') || h.includes('domaine') || h.includes('chateau')) {
      columnMap['producer'] = index;
    }
    // Vintage
    else if (h.includes('vintage') || h.includes('year')) {
      columnMap['vintage'] = index;
    }
    // Region
    else if (h.includes('region') || h.includes('appellation') || h.includes('country')) {
      columnMap['region'] = index;
    }
    // Quantity
    else if (h.includes('qty') || h.includes('quantity') || h.includes('cases') || h.includes('amount')) {
      columnMap['quantity'] = index;
    }
    // Sell price
    else if (h.includes('price') || h.includes('sell') || h.includes('usd') || h.includes('$') || h.includes('total')) {
      columnMap['sellPrice'] = index;
    }
    // LWIN
    else if (h.includes('lwin') || h.includes('liv-ex')) {
      columnMap['lwin'] = index;
    }
    // Case config
    else if (h.includes('config') || h.includes('pack') || h.includes('format') || h.includes('size')) {
      columnMap['caseConfig'] = index;
    }
  });

  // Must have at least product name and quantity columns
  if (columnMap['productName'] === undefined || columnMap['quantity'] === undefined) {
    return null;
  }

  const items: ParsedPoItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.trim()) continue;

    const cells = parseCSVLine(line);
    const productName = cells[columnMap['productName']]?.trim() || '';

    if (!productName) continue;

    // Parse quantity
    const qtyStr = cells[columnMap['quantity']]?.trim() || '0';
    const quantity = parseInt(qtyStr.replace(/[^\d]/g, ''), 10) || 0;

    if (quantity <= 0) continue;

    // Parse sell price
    let sellPricePerCaseUsd: number | undefined;
    if (columnMap['sellPrice'] !== undefined) {
      const priceStr = cells[columnMap['sellPrice']]?.trim() || '';
      const priceMatch = priceStr.match(/[\d,]+\.?\d*/);
      if (priceMatch) {
        sellPricePerCaseUsd = parseFloat(priceMatch[0].replace(',', ''));
      }
    }

    items.push({
      lineNumber: columnMap['lineNumber'] !== undefined
        ? parseInt(cells[columnMap['lineNumber']] || String(i), 10) || i
        : i,
      productName,
      producer: columnMap['producer'] !== undefined ? cells[columnMap['producer']]?.trim() : undefined,
      vintage: columnMap['vintage'] !== undefined ? cells[columnMap['vintage']]?.trim() : undefined,
      region: columnMap['region'] !== undefined ? cells[columnMap['region']]?.trim() : undefined,
      quantity,
      sellPricePerCaseUsd,
      lwin: columnMap['lwin'] !== undefined ? cells[columnMap['lwin']]?.trim() : undefined,
      caseConfig: columnMap['caseConfig'] !== undefined ? cells[columnMap['caseConfig']]?.trim() : undefined,
      confidence: 0.9, // High confidence for direct parsing
    });
  }

  return items.length > 0 ? items : null;
};

// Zod schema for AI extraction
const extractedPoItemsSchema = z.object({
  items: z.array(
    z.object({
      lineNumber: z.number().describe('Line number in the PO (1-based)'),
      productName: z.string().describe('Wine product name'),
      producer: z.string().optional().describe('Producer/winery name'),
      vintage: z.string().optional().describe('Vintage year'),
      region: z.string().optional().describe('Wine region or appellation'),
      quantity: z.number().describe('Number of cases ordered'),
      sellPricePerCaseUsd: z.number().optional().describe('Sell price per case in USD'),
      bottleSize: z.string().optional().describe('Bottle size (e.g., 75cl, 1.5L)'),
      caseConfig: z.string().optional().describe('Case configuration (e.g., 6x75cl, 12x75cl)'),
      lwin: z.string().optional().describe('LWIN code if present'),
      notes: z.string().optional().describe('Any additional notes'),
      confidence: z.number().min(0).max(1).describe('Confidence in extraction accuracy'),
    })
  ),
});

/**
 * Parse customer PO Excel/CSV using AI
 *
 * @example
 *   const result = await parseCustomerPoExcel(csvContent);
 *   // result.items contains parsed PO line items
 */
const parseCustomerPoExcel = async (
  content: string
): Promise<{ items: ParsedPoItem[]; message: string }> => {
  // Try direct CSV parsing first
  logger.dev('Attempting direct CSV parsing for customer PO');
  const directParsedItems = tryParseStructuredPoCSV(content);

  if (directParsedItems && directParsedItems.length > 0) {
    logger.dev(`Direct CSV parsing successful: ${directParsedItems.length} items found`);
    return {
      items: directParsedItems,
      message: `Parsed ${directParsedItems.length} items from spreadsheet`,
    };
  }

  logger.dev('Direct CSV parsing failed, falling back to AI');

  // Fall back to AI parsing
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    throw new Error('AI parsing is not configured. OPENAI_API_KEY is not set.');
  }

  const openai = createOpenAI({ apiKey: openaiKey });

  const systemPrompt = `You are an expert at extracting wine order data from customer purchase orders.

Parse the document to extract each line item with:
- lineNumber: Sequential line number (1-based)
- productName: Wine name (include vintage in name if combined)
- producer: Winery/producer name (extract from product name if combined like "Château Margaux")
- vintage: Year (e.g., "2018", "2019")
- region: Wine region (e.g., "Margaux", "Napa Valley")
- quantity: Number of cases ordered (must be > 0)
- sellPricePerCaseUsd: Price per case in USD (extract number from "$150", "150 USD", "150.00/case")
- bottleSize: Bottle size (e.g., "75cl", "750ml", "1.5L")
- caseConfig: Case configuration (e.g., "6x75cl", "12", "6-pack")
- lwin: LWIN code if present (7-18 digit wine identifier)
- notes: Any special notes or comments
- confidence: Your confidence in extraction (0-1)

Handle various formats:
- Structured spreadsheets with columns
- Messy data with combined fields
- Various price formats
- Missing or partial information

Skip rows that are headers, totals, or empty.`;

  const userPrompt = `Parse the following customer purchase order and extract all wine line items:

${content}`;

  const result = await generateObject({
    model: openai('gpt-4o'),
    schema: extractedPoItemsSchema,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const extractedItems = result.object.items;

  return {
    items: extractedItems,
    message: `AI parsed ${extractedItems.length} items`,
  };
};

export default parseCustomerPoExcel;

export type { ParsedPoItem };
