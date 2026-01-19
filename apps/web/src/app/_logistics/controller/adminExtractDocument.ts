import { createOpenAI } from '@ai-sdk/openai';
import { TRPCError } from '@trpc/server';
import { generateObject } from 'ai';
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
        hsCode: z.string().optional().describe('HS/tariff code'),
        quantity: z.number().optional().describe('Quantity'),
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
        category: z.string().describe('Cost category (freight, handling, customs, etc.)'),
        description: z.string().optional().describe('Description of charge'),
        amount: z.number().describe('Amount'),
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
  const baseInstructions = `You are an expert at extracting structured data from logistics documents.
Be precise with numbers, dates, and reference numbers.
For dates, use ISO 8601 format (YYYY-MM-DD).
For currency, use standard codes (USD, EUR, AED, GBP, etc.).
Extract all available information that matches the schema fields.`;

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
 * Uses GPT-4o to extract data from freight invoices, packing lists, BOLs, AWBs, etc.
 * Supports both image files (PNG, JPG) and PDF documents.
 * Returns extracted data immediately for display and export.
 */
const adminExtractDocument = adminProcedure.input(extractDocumentSchema).mutation(async ({ input }) => {
  const { file: rawFile, fileType, documentType } = input;

  // Strip data URL prefix if present (e.g., "data:application/pdf;base64,")
  // The AI SDK expects raw base64, not a data URL
  const file = rawFile.includes(',') ? rawFile.split(',')[1] : rawFile;

  const openaiKey = process.env.OPENAI_API_KEY;

  logger.info('[LogisticsDocumentExtraction] Starting extraction:', {
    hasKey: !!openaiKey,
    documentType,
    fileType,
  });

  if (!openaiKey) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'AI extraction is not configured. OPENAI_API_KEY environment variable is not set.',
    });
  }

  const openai = createOpenAI({
    apiKey: openaiKey,
  });

  const systemPrompt = getSystemPrompt(documentType);

  try {
    let extractedData: z.infer<typeof extractedLogisticsDataSchema>;

    if (fileType.startsWith('image/')) {
      const result = await generateObject({
        model: openai('gpt-4o'),
        schema: extractedLogisticsDataSchema,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please extract all logistics data from this ${documentType.replace('_', ' ')} image. Extract all fields that are visible in the document.`,
              },
              {
                type: 'image',
                image: file,
              },
            ],
          },
        ],
      });

      extractedData = result.object;
    } else if (fileType === 'application/pdf') {
      const result = await generateObject({
        model: openai('gpt-4o'),
        schema: extractedLogisticsDataSchema,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please extract all logistics data from this ${documentType.replace('_', ' ')} PDF. Extract all fields that are visible in the document.`,
              },
              {
                type: 'file',
                data: file,
                mediaType: 'application/pdf',
              },
            ],
          },
        ],
      });

      extractedData = result.object;
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
