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
        lwin: z.string().optional().describe('LWIN-18 code - found in "Product Code" column. Format is 18 digits like "100604520190600750"'),
        producer: z.string().optional().describe('Producer/winery name (e.g., "Chateau Angelus", "Domaine de la Romanee-Conti")'),
        vintage: z.number().optional().describe('Vintage year from "Vintage" column (e.g., 2015, 2018, 2021)'),
        bottleSize: z.string().optional().describe('Bottle size in ml. Parse from "Size" column: "6x75cl"→"750ml", "12x75cl"→"750ml", "1x150cl"→"1500ml", "3x75cl"→"750ml"'),
        bottlesPerCase: z.number().optional().describe('Bottles per case from "Size" column. Parse: "6x75cl"→6, "12x75cl"→12, "3x75cl"→3, "1x150cl"→1'),
        alcoholPercent: z.number().optional().describe('Alcohol % from "ABV %" column (e.g., 12.5, 14.0, 14.5)'),
        region: z.string().optional().describe('Wine region/appellation extracted from product name (e.g., "Saint-Emilion Grand Cru", "Margaux", "Pomerol")'),
        hsCode: z.string().optional().describe('HS/Commodity code from "Commodity Code" column. Extract ALL digits exactly (e.g., "2204214290", "2204214210")'),
        quantity: z.number().optional().describe('DEPRECATED - use cases instead'),
        cases: z.number().optional().describe('Number of CASES from "Qty" column. This is the case count, NOT bottle count. E.g., Qty=1 means 1 case'),
        weight: z.number().optional().describe('Weight in kg'),
        volume: z.number().optional().describe('Volume in m³'),
        unitPrice: z.number().optional().describe('Unit price per case from "Unit Price USD" column'),
        total: z.number().optional().describe('Line total from "Total Price USD" column'),
        countryOfOrigin: z.string().optional().describe('Country from "Origin" column (e.g., "France", "Italy", "Spain")'),
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
/**
 * Get document-type-specific extraction prompt for the user message
 */
const getExtractionPrompt = (documentType: string) => {
  if (documentType === 'packing_list') {
    return `TRANSCRIBE this WINE PACKING LIST document.

CRITICAL COLUMN MAPPING FOR PACKING LISTS:
| Column Name | Maps To | Description |
|-------------|---------|-------------|
| "Number of cases" or "Qty" | cases | NUMBER OF CASES - put this in 'cases' field |
| "CASES" or "Pack Type" | bottlesPerCase | Parse "cases of 12 bottles" → 12 |
| "Number of bottles" | quantity (for verification) | Total bottles = cases × bottlesPerCase |
| Product/Description | productName | Full wine name |
| Vintage | vintage | 4-digit year |

PARSING PACK TYPE - CRITICAL:
- "cases of 12 bottles" → bottlesPerCase: 12, bottleSize: "750ml"
- "cases of 6 bottles" → bottlesPerCase: 6, bottleSize: "750ml"
- "wb × 12 bottles" or "wooden box 12" → bottlesPerCase: 12, bottleSize: "750ml"
- "wb × 6 bottles" or "wooden box 6" → bottlesPerCase: 6, bottleSize: "750ml"
- "3 wb × 12 bottles" means 3 cases with 12 bottles each → cases: 3, bottlesPerCase: 12

VALIDATION - Use both values for cross-checking:
1. Read "Number of cases" → put in 'cases' field
2. Read "CASES" column → parse to get 'bottlesPerCase'
3. Read "Number of bottles" → put in 'quantity' field for verification
4. Verify: cases × bottlesPerCase should equal quantity (Number of bottles)

EXAMPLE:
Row: Product="Château Fontenil 2005", Number of cases=3, CASES="wb × 12 bottles", Number of bottles=36
Verification: 3 × 12 = 36 ✓
Result: cases=3, bottlesPerCase=12, bottleSize="750ml", quantity=36, productName="Château Fontenil 2005", vintage=2005

Also look for document totals like "Total: 80 CASES" or "504 bottles" for verification.
Extract EVERY line item. Copy product names exactly as written.`;
  }

  // Default: Commercial invoice format
  return `TRANSCRIBE this WINE COMMERCIAL INVOICE document.

COLUMN MAPPING FOR WINE INVOICES - CRITICAL:
| Column | Maps to | Description |
|--------|---------|-------------|
| Qty | cases | NUMBER OF CASES (NOT bottles!) |
| Size | bottlesPerCase + bottleSize | Parse "6x75cl" → bottlesPerCase:6, bottleSize:"750ml" |
| ABV % | alcoholPercent | Alcohol percentage |
| Origin | countryOfOrigin | Country (France, Italy, Spain, etc.) |
| Description of Goods | productName + producer + region | Full wine name |
| Product Code | lwin | LWIN-18 code (18-digit SKU like "100604520190600750") |
| Vintage | vintage | 4-digit year |
| Unit Price USD | unitPrice | Price per case |
| Total Price USD | total | Line total |
| Commodity Code | hsCode | HS tariff code (10 digits like "2204214290") |

PARSING SIZE COLUMN - VERY IMPORTANT:
- "6x75cl" → bottlesPerCase: 6, bottleSize: "750ml"
- "12x75cl" → bottlesPerCase: 12, bottleSize: "750ml"
- "3x75cl" → bottlesPerCase: 3, bottleSize: "750ml"
- "1x150cl" → bottlesPerCase: 1, bottleSize: "1500ml"

CRITICAL RULE: The "Qty" column shows NUMBER OF CASES!
- If Qty=1 and Size="6x75cl", this means 1 CASE containing 6 bottles
- Do NOT put "6" in cases just because the Size says "6x75cl"
- The "6" in "6x75cl" goes into bottlesPerCase, NOT cases

Extract EVERY line item. Copy product names exactly as written.`;
};

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
    packing_list: `Focus on extracting WINE PACKING LIST data:

CRITICAL COLUMN MAPPING FOR PACKING LISTS:
| Column Name | Maps To | Description |
|-------------|---------|-------------|
| "Number of cases" or "Qty" or "Cases" | cases | NUMBER OF CASES - THIS IS WHAT YOU PUT IN 'cases' |
| "CASES" or "Pack" or "Type" | bottlesPerCase | Parse "cases of 12 bottles" → bottlesPerCase: 12 |
| "Number of bottles" or "Bottles" | VERIFICATION ONLY | Do NOT put this in 'cases'! |
| Description/Product | productName | Full product name |
| Vintage | vintage | 4-digit year |

PARSING PACK TYPE COLUMN:
- "cases of 12 bottles" → bottlesPerCase: 12
- "cases of 6 bottles" → bottlesPerCase: 6
- "wooden box 12" or "wb × 12 bottles" → bottlesPerCase: 12
- "wooden box 6" or "wb × 6 bottles" → bottlesPerCase: 6
- "3 wb × 12 bottles" means 3 cases, each with 12 bottles → cases: 3, bottlesPerCase: 12

CRITICAL: "Number of bottles" is the TOTAL bottle count (cases × bottlesPerCase).
DO NOT use "Number of bottles" for the 'cases' field!
ALWAYS use "Number of cases" for the 'cases' field!

EXAMPLE ROW FROM PACKING LIST:
Product: "Château Fontenil 2005", Number of cases: 3, CASES: "wb × 12 bottles", Number of bottles: 36
Result: cases: 3, bottlesPerCase: 12, productName: "Château Fontenil 2005", vintage: 2005

Also extract:
- Total cases from document summary (look for "Total cases: X" or "80 CASES")
- Total bottles from document summary (for verification)
- Shipper and consignee details
- HS codes and country of origin
- Weights and dimensions if present`,
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
    commercial_invoice: `Focus on extracting wine commercial invoice data:

COLUMN MAPPING - CRITICAL:
- "Qty" column → cases (NUMBER OF CASES, not bottles!)
- "Size" column (e.g., "6x75cl") → parse into bottlesPerCase (6) and bottleSize ("750ml")
- "Product Code" column → lwin (this is the LWIN-18 SKU code!)
- "ABV %" column → alcoholPercent
- "Origin" column → countryOfOrigin
- "Vintage" column → vintage
- "Commodity Code" column → hsCode
- "Unit Price USD" column → unitPrice
- "Total Price USD" column → total

PARSING "Size" COLUMN - EXAMPLES:
- "6x75cl" → bottlesPerCase: 6, bottleSize: "750ml"
- "12x75cl" → bottlesPerCase: 12, bottleSize: "750ml"
- "3x75cl" → bottlesPerCase: 3, bottleSize: "750ml"
- "1x150cl" → bottlesPerCase: 1, bottleSize: "1500ml"

CRITICAL: The "Qty" column shows NUMBER OF CASES. If Qty=1 and Size=6x75cl, that means 1 case containing 6 bottles.`,
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

    const extractionPrompt = getExtractionPrompt(documentType);

    if (fileType.startsWith('image/')) {
      const messages = [
        {
          role: 'user' as const,
          content: [
            {
              type: 'text' as const,
              text: extractionPrompt,
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
          prompt: `${extractionPrompt}

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
                text: extractionPrompt,
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
