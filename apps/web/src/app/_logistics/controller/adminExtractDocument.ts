import { createAnthropic } from '@ai-sdk/anthropic';
import { TRPCError } from '@trpc/server';
import { generateObject } from 'ai';
import pdfParse from 'pdf-parse';
import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import extractDocumentSchema from '../schemas/extractDocumentSchema';

/**
 * Schema for extracted logistics document data
 */
const extractedLogisticsDataSchema = z.object({
  // Document metadata
  documentType: z.string().optional().describe('Detected document type'),
  documentNumber: z.string().optional().describe('Document number or reference'),
  documentDate: z.string().optional().describe('Document date in ISO format'),

  // Freight invoice fields
  vendor: z.string().optional().describe('Vendor/forwarder name'),
  vendorAddress: z.string().optional().describe('Vendor address'),
  totalAmount: z.number().optional().describe('Total invoice amount'),
  currency: z.string().optional().describe('Currency code (USD, EUR, AED, etc.)'),
  paymentTerms: z.string().optional().describe('Payment terms'),
  dueDate: z.string().optional().describe('Payment due date'),

  // BOL/AWB fields
  bolNumber: z.string().optional().describe('Bill of Lading number'),
  awbNumber: z.string().optional().describe('Airway Bill number'),
  vesselName: z.string().optional().describe('Vessel/ship name'),
  voyageNumber: z.string().optional().describe('Voyage number'),
  flightNumber: z.string().optional().describe('Flight number'),
  containerNumber: z.string().optional().describe('Container number'),

  // Route information
  shipper: z.string().optional().describe('Shipper name'),
  shipperAddress: z.string().optional().describe('Shipper address'),
  consignee: z.string().optional().describe('Consignee name'),
  consigneeAddress: z.string().optional().describe('Consignee address'),
  portOfLoading: z.string().optional().describe('Port/airport of loading'),
  portOfDischarge: z.string().optional().describe('Port/airport of discharge'),
  placeOfDelivery: z.string().optional().describe('Final place of delivery'),

  // Dates
  shipmentDate: z.string().optional().describe('Shipment/departure date'),
  arrivalDate: z.string().optional().describe('Estimated or actual arrival date'),

  // Cargo details
  totalWeight: z.number().optional().describe('Total gross weight in kg'),
  totalVolume: z.number().optional().describe('Total volume in m³'),
  totalCases: z.number().optional().describe('Total number of cases/cartons'),
  totalPallets: z.number().optional().describe('Total number of pallets'),

  // Line items (for invoices, packing lists)
  lineItems: z
    .array(
      z.object({
        description: z.string().optional().describe('Item description'),
        productName: z.string().optional().describe('Product name'),
        lwin: z.string().optional().describe('LWIN code (Liv-ex Wine Identification Number) - may be labeled as "Product Code", "LWIN", "SKU", or "Item Code" in the document'),
        producer: z.string().optional().describe('Producer/winery name extracted from description'),
        vintage: z.number().optional().describe('Vintage year (e.g., 2015, 2018, 2021) - extract 4-digit year from product description'),
        bottleSize: z.string().optional().describe('Bottle size (e.g., "750ml", "1.5L", "375ml") - extract from description like "0.75L" or "75cl"'),
        bottlesPerCase: z.number().optional().describe('Bottles per case / case configuration (e.g., 6, 12) - often shown as "6x75cl" or just a number'),
        alcoholPercent: z.number().optional().describe('Alcohol percentage (e.g., 12.5, 14.0) - extract from description'),
        region: z.string().optional().describe('Wine region or appellation (e.g., "Bordeaux", "Margaux", "Napa Valley")'),
        hsCode: z.string().optional().describe('FULL HS/tariff/commodity code with ALL digits exactly as shown (e.g., 22042109, 22042132, NOT truncated to 22042100)'),
        quantity: z.number().optional().describe('Total quantity of bottles'),
        cases: z.number().optional().describe('Number of cases'),
        weight: z.number().optional().describe('Weight in kg'),
        volume: z.number().optional().describe('Volume in m³'),
        unitPrice: z.number().optional().describe('Unit price'),
        total: z.number().optional().describe('Line total'),
        countryOfOrigin: z.string().optional().describe('Country of origin'),
      }),
    )
    .optional()
    .describe('Line items from the document'),

  // Cost breakdown (for freight invoices)
  costBreakdown: z
    .array(
      z.object({
        category: z.string().optional().describe('Cost category (freight, handling, customs, etc.)'),
        description: z.string().optional().describe('Description of charge'),
        amount: z.number().optional().describe('Amount'),
        currency: z.string().optional().describe('Currency if different from main'),
      }),
    )
    .optional()
    .describe('Cost breakdown from freight invoice'),

  // Additional notes
  notes: z.string().optional().describe('Any additional notes or remarks'),
  specialInstructions: z.string().optional().describe('Special handling instructions'),
});

/**
 * Get the appropriate system prompt based on document type
 */
const getSystemPrompt = (documentType: string) => {
  const baseInstructions = `You are a precise OCR system that extracts structured data from logistics documents.

ABSOLUTE RULES - VIOLATION IS UNACCEPTABLE:

1. TRANSCRIBE ONLY - You are a transcription tool. Copy text EXACTLY as it appears character-by-character.

2. ZERO INVENTION - NEVER generate, guess, or invent ANY data. If you cannot read something, leave that field EMPTY. Do NOT make up products, quantities, or codes that don't exist in the document.

3. NO FAMOUS BRANDS - You are FORBIDDEN from outputting well-known brand names (Moet, Veuve Clicquot, Dom Perignon, Krug, etc.) unless those EXACT words appear in the document.

4. PRODUCT NAME RULE - Copy the FULL product description exactly as written.

5. VERIFY YOUR OUTPUT - Before returning EACH item, confirm it EXISTS in the document. If you cannot find it, DO NOT INCLUDE IT. Ghost/phantom entries are unacceptable.

6. NUMBERS - Only use numbers you can clearly see. Do not calculate or estimate.

7. DATES - Use ISO 8601 format (YYYY-MM-DD). Only use dates visible in the document.

8. HS/COMMODITY CODES - CRITICAL:
   - Each row has its OWN commodity code in the rightmost column
   - Codes vary by product: 22042109, 22042132, 22041000, 22042142, 22042198, etc.
   - DO NOT default everything to 22042100 - that is INCORRECT
   - Read each code digit-by-digit from the document
   - If you cannot read a code, leave it EMPTY (do not guess 22042100)

9. COMPLETENESS - Extract ALL rows from the document. Count them. If the document shows 50 items, you must return 50 items.

10. NO HALLUCINATION - Every single item you return MUST exist in the source document. Do not invent products.

You are a TRANSCRIPTION tool, not a creative writer. Extract ONLY what exists in the document.`;

  const typeSpecificInstructions: Record<string, string> = {
    freight_invoice: `Focus on extracting:
- Vendor/forwarder details
- Invoice number and date
- All cost line items (freight, handling, customs, insurance, etc.)
- Total amount and currency
- Payment terms`,
    packing_list: `Focus on extracting:
- All product line items with quantities, weights, and dimensions
- Total cases, pallets, weight, and volume
- HS codes and country of origin
- Shipper and consignee details`,
    bill_of_lading: `Focus on extracting:
- BOL number
- Vessel name and voyage number
- Container number(s)
- Port of loading and discharge
- Shipper and consignee
- Cargo description and quantities`,
    airway_bill: `Focus on extracting:
- AWB number
- Flight number(s)
- Airport of origin and destination
- Shipper and consignee
- Cargo weight and dimensions`,
    commercial_invoice: `Focus on extracting:
- Invoice number and date
- Buyer and seller details
- All product line items with HS codes
- Unit prices and totals
- Incoterms and payment terms`,
    customs_document: `Focus on extracting:
- Declaration number
- HS codes and tariff classifications
- Country of origin for all items
- Declared values
- Any duty/tax amounts`,
    general: `Extract all relevant logistics information you can identify from the document.`,
  };

  return `${baseInstructions}\n\n${typeSpecificInstructions[documentType] || typeSpecificInstructions.general}`;
};

/**
 * Extract structured data from a logistics document
 *
 * Uses Claude to extract data from freight invoices, packing lists, BOLs, AWBs, etc.
 * Supports both image files (PNG, JPG) and PDF documents.
 * Returns extracted data immediately for display and export.
 */
const adminExtractDocument = adminProcedure.input(extractDocumentSchema).mutation(async ({ input }) => {
  const { file: rawFile, fileType, documentType } = input;

  // Strip data URL prefix if present (e.g., "data:application/pdf;base64,")
  // The AI SDK expects raw base64, not a data URL
  const file = rawFile.includes(',') ? rawFile.split(',')[1] ?? rawFile : rawFile;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  logger.info('[LogisticsDocumentExtraction] Starting extraction:', {
    hasKey: !!anthropicKey,
    documentType,
    fileType,
  });

  if (!anthropicKey) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'AI extraction is not configured. ANTHROPIC_API_KEY environment variable is not set.',
    });
  }

  const anthropic = createAnthropic({
    apiKey: anthropicKey,
  });

  const systemPrompt = getSystemPrompt(documentType);

  try {
    let extractedData: z.infer<typeof extractedLogisticsDataSchema>;

    if (fileType.startsWith('image/')) {
      const messages = [
        {
          role: 'user' as const,
          content: [
            {
              type: 'text' as const,
              text: `TRANSCRIBE all data from this ${documentType.replace('_', ' ')} image.

CRITICAL RULES:
1. Product names must be copied CHARACTER BY CHARACTER from the document
2. Wine products typically look like: "Producer Name Wine Type Appellation Year 0.75L 12.5" - copy the FULL string exactly
3. NEVER output famous brand names (Moet, Dom Perignon, Veuve Clicquot, Krug, etc.) unless those EXACT letters appear
4. If you cannot read text clearly, output "UNREADABLE"
5. Extract EVERY line item - count them to ensure completeness

LWIN EXTRACTION - CRITICAL FOR SKU:
- lwin: Extract the LWIN (Liv-ex Wine Identification Number) from each row
- May be labeled as "Product Code", "LWIN", "SKU", "Item Code", or "Code" in the document
- LWIN is typically a numeric code like "1010279" or alphanumeric - copy EXACTLY as shown
- This is used as the unique SKU identifier - extraction is ESSENTIAL

WINE FIELD EXTRACTION - PARSE EACH LINE ITEM:
- producer: Extract winery/producer name (e.g., "Chateau Margaux", "Domaine de la Romanee-Conti")
- vintage: Extract 4-digit year (e.g., 2015, 2018, 2021)
- bottleSize: Extract bottle size like "750ml", "0.75L", "1.5L", "375ml" - convert "75cl" to "750ml"
- bottlesPerCase: Extract case config (e.g., 6 or 12) from patterns like "6x75cl" or separate column
- alcoholPercent: Extract alcohol % (e.g., 12.5, 14.0)
- region: Extract region/appellation (e.g., "Bordeaux", "Pomerol", "Saint-Emilion")
- countryOfOrigin: Extract country (e.g., "France", "Italy", "Spain")

HS CODE EXTRACTION - EXTREMELY IMPORTANT:
- The document has a "Commodity Code" column - READ EACH ROW'S CODE INDIVIDUALLY
- Each product may have a DIFFERENT 8-digit code (22042109, 22042132, 22041000, 22042142, etc.)
- DO NOT assume all wines are 22042100 - that is WRONG
- Look at the rightmost numeric column for the commodity/HS code
- If you cannot read a specific code clearly, leave it empty rather than defaulting to 22042100

This is a TRANSCRIPTION task, not interpretation. Copy exactly what you see.`,
            },
            {
              type: 'image' as const,
              image: file,
            },
          ],
        },
      ];

      const result = await generateObject({
        model: anthropic('claude-sonnet-4-20250514'),
        schema: extractedLogisticsDataSchema,
        system: systemPrompt,
        messages,
      });

      extractedData = result.object;
    } else if (fileType === 'application/pdf') {
      // Try to extract text from PDF using pdf-parse first (works for digital PDFs)
      const pdfBuffer = Buffer.from(file, 'base64');
      let pdfText = '';

      try {
        const pdfData = await pdfParse(pdfBuffer);
        pdfText = pdfData.text;

        logger.info('[LogisticsDocumentExtraction] PDF text extracted:', {
          pages: pdfData.numpages,
          textLength: pdfText.length,
          textPreview: pdfText.substring(0, 500),
        });
      } catch (parseError) {
        logger.warn('[LogisticsDocumentExtraction] pdf-parse failed, will try direct PDF processing:', {
          error: parseError instanceof Error ? parseError.message : 'Unknown error',
        });
      }

      // If we got meaningful text, use text-based extraction
      if (pdfText && pdfText.trim().length >= 50) {
        const result = await generateObject({
          model: anthropic('claude-sonnet-4-20250514'),
          schema: extractedLogisticsDataSchema,
          system: systemPrompt,
          maxTokens: 16384,
          prompt: `Parse this invoice/document text and extract structured data.

EXAMPLES OF CORRECT EXTRACTION:
Input text: "François Thienpont Terre Elysée 2021 0.75L 12 22042142 420 70 $28.58"
Output: { productName: "François Thienpont Terre Elysée 2021 0.75L 12", hsCode: "22042142", quantity: 420, cases: 70, unitPrice: 28.58 }

Input text: "Masseria Alfano Fiano d'Avellino DOCG Riserva Il Gheppio 2020 0.75L 12.5 22042138 420 70 $38.11"
Output: { productName: "Masseria Alfano Fiano d'Avellino DOCG Riserva Il Gheppio 2020 0.75L 12.5", hsCode: "22042138", quantity: 420, cases: 70, unitPrice: 38.11 }

RULES:
- Copy product names EXACTLY as they appear - these are wine producers, copy the full description
- The Description column contains the full product name including producer, wine, vintage, size, and alcohol %
- Extract ALL rows from the table - count them to ensure completeness
- HS CODES ARE CRITICAL: Extract the COMPLETE code with ALL digits. Codes like 22042109, 22042132, 22041000 are DIFFERENT codes - do NOT truncate or simplify to 22042100. Each row may have a unique HS code.

LWIN EXTRACTION - CRITICAL FOR SKU:
- lwin: Extract the LWIN (Liv-ex Wine Identification Number) from each row
- May be labeled as "Product Code", "LWIN", "SKU", "Item Code", or "Code"
- Copy the code EXACTLY as shown - this is used as the unique SKU identifier

WINE FIELD EXTRACTION - FOR EACH LINE ITEM, EXTRACT:
- producer: The winery/producer name (first part of description)
- vintage: The 4-digit year (e.g., 2015, 2018, 2021)
- bottleSize: Bottle size like "750ml" (convert "0.75L" or "75cl" to "750ml")
- bottlesPerCase: Case configuration (6 or 12) - look for "6x75cl" or "12x75cl" patterns
- alcoholPercent: Alcohol % (e.g., 12.5, 14.0) - usually at end of description
- region: Wine region/appellation if shown (e.g., "Bordeaux", "Pomerol", "Saint-Emilion")
- countryOfOrigin: Country of origin if shown

--- DOCUMENT TEXT ---
${pdfText}
--- END DOCUMENT ---`,
        });

        extractedData = result.object;
      } else {
        // For scanned PDFs or PDFs with minimal text, use Claude's vision capability
        // Claude can process PDFs directly as images
        logger.info('[LogisticsDocumentExtraction] PDF has minimal text, using vision-based extraction', {
          textLength: pdfText?.length ?? 0,
        });

        const messages = [
          {
            role: 'user' as const,
            content: [
              {
                type: 'text' as const,
                text: `TRANSCRIBE all data from this ${documentType.replace('_', ' ')} document.

CRITICAL RULES:
1. Product names must be copied CHARACTER BY CHARACTER from the document
2. Wine products typically look like: "Producer Name Wine Type Appellation Year 0.75L 12.5" - copy the FULL string exactly
3. NEVER output famous brand names (Moet, Dom Perignon, Veuve Clicquot, Krug, etc.) unless those EXACT letters appear
4. If you cannot read text clearly, output "UNREADABLE"
5. Extract EVERY line item - count them to ensure completeness

LWIN EXTRACTION - CRITICAL FOR SKU:
- lwin: Extract the LWIN (Liv-ex Wine Identification Number) from each row
- May be labeled as "Product Code", "LWIN", "SKU", "Item Code", or "Code" in the document
- LWIN is typically a numeric code like "1010279" or alphanumeric - copy EXACTLY as shown
- This is used as the unique SKU identifier - extraction is ESSENTIAL

WINE FIELD EXTRACTION - PARSE EACH LINE ITEM:
- producer: Extract winery/producer name (e.g., "Chateau Margaux", "Domaine de la Romanee-Conti")
- vintage: Extract 4-digit year (e.g., 2015, 2018, 2021)
- bottleSize: Extract bottle size like "750ml", "0.75L", "1.5L", "375ml" - convert "75cl" to "750ml"
- bottlesPerCase: Extract case config (e.g., 6 or 12) from patterns like "6x75cl" or separate column
- alcoholPercent: Extract alcohol % (e.g., 12.5, 14.0)
- region: Extract region/appellation (e.g., "Bordeaux", "Pomerol", "Saint-Emilion")
- countryOfOrigin: Extract country (e.g., "France", "Italy", "Spain")

HS CODE EXTRACTION - EXTREMELY IMPORTANT:
- The document has a "Commodity Code" column - READ EACH ROW'S CODE INDIVIDUALLY
- Each product may have a DIFFERENT 8-digit code (22042109, 22042132, 22041000, 22042142, etc.)
- DO NOT assume all wines are 22042100 - that is WRONG
- Look at the rightmost numeric column for the commodity/HS code
- If you cannot read a specific code clearly, leave it empty rather than defaulting to 22042100

This is a TRANSCRIPTION task, not interpretation. Copy exactly what you see.`,
              },
              {
                type: 'file' as const,
                data: file,
                mediaType: 'application/pdf' as const,
              },
            ],
          },
        ];

        const result = await generateObject({
          model: anthropic('claude-sonnet-4-20250514'),
          schema: extractedLogisticsDataSchema,
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

    logger.info('[LogisticsDocumentExtraction] Extraction complete:', {
      documentType: extractedData.documentType,
      hasLineItems: !!extractedData.lineItems?.length,
      hasCostBreakdown: !!extractedData.costBreakdown?.length,
    });

    return {
      success: true,
      data: extractedData,
    };
  } catch (error) {
    logger.error('[LogisticsDocumentExtraction] Extraction failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      documentType,
    });

    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to extract document: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});

export default adminExtractDocument;
