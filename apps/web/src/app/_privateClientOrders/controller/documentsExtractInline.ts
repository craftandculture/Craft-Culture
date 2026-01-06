import { createOpenAI } from '@ai-sdk/openai';
import { TRPCError } from '@trpc/server';
import { generateObject } from 'ai';
import { z } from 'zod';

import { winePartnerProcedure } from '@/lib/trpc/procedures';

const extractInlineSchema = z.object({
  file: z.string().describe('Base64 encoded file data URL'),
  fileType: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']),
});

/**
 * Schema for extracted invoice line items
 */
const extractedDataSchema = z.object({
  invoiceNumber: z.string().optional().describe('Invoice number or reference'),
  invoiceDate: z.string().optional().describe('Invoice date in ISO format'),
  currency: z.string().optional().describe('Currency code (e.g., GBP, USD, EUR)'),
  lineItems: z
    .array(
      z.object({
        productName: z.string().describe('Wine product name'),
        producer: z.string().optional().describe('Wine producer/winery name'),
        vintage: z.string().optional().describe('Vintage year'),
        region: z.string().optional().describe('Wine region'),
        quantity: z.number().describe('Number of cases'),
        unitPrice: z.number().optional().describe('Price per case'),
        total: z.number().optional().describe('Line item total'),
        caseConfig: z
          .number()
          .optional()
          .describe('Number of bottles per case (e.g., 6 from "6x75cl", 12 from "12x75cl")'),
        bottleSize: z
          .number()
          .optional()
          .describe('Bottle size in milliliters (e.g., 750 from "75cl", 1500 from "150cl")'),
      }),
    )
    .describe('Line items from the invoice'),
  totalAmount: z.number().optional().describe('Total invoice amount'),
});

/**
 * Extract structured data from a document inline (without saving)
 *
 * Uses GPT-4o to extract wine products from invoices and price lists.
 * Supports both image files (PNG, JPG) and PDF documents.
 * Returns extracted data immediately for form population.
 */
const documentsExtractInline = winePartnerProcedure.input(extractInlineSchema).mutation(async ({ input }) => {
  const { file, fileType } = input;

  // Read OpenAI key at runtime - MUST be read here, not from a module-level import
  // because env vars may not be available during build/module initialization
  const openaiKey = process.env.OPENAI_API_KEY;

  // Debug logging - will show in Vercel function logs
  console.log('[DocumentExtraction] Runtime env check:', {
    hasKey: !!openaiKey,
    keyLength: openaiKey?.length ?? 0,
    keyPrefix: openaiKey?.substring(0, 7) ?? 'none',
    nodeEnv: process.env.NODE_ENV,
  });

  if (!openaiKey) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'AI extraction is not configured. OPENAI_API_KEY environment variable is not set.',
    });
  }

  // Create OpenAI client with explicit API key
  const openai = createOpenAI({
    apiKey: openaiKey,
  });

  try {
    let extractedData: z.infer<typeof extractedDataSchema>;

    if (fileType.startsWith('image/')) {
      // For images, use vision capabilities
      const result = await generateObject({
        model: openai('gpt-4o'),
        schema: extractedDataSchema,
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting structured data from wine invoice images.
Extract all wine products from the invoice with their details.
For each line item, extract:
- productName: The full wine name (e.g., "Château Margaux 2018")
- producer: The winery or producer name
- vintage: The year (e.g., "2018")
- region: The wine region (e.g., "Bordeaux", "Burgundy")
- quantity: Number of cases ordered
- unitPrice: Price per case
- total: Line item total
- caseConfig: Number of bottles per case - IMPORTANT: Look for patterns like "6x75cl", "12x75cl", "6x750ml" in the product name or description. Extract the first number (e.g., 6 from "6x75cl", 12 from "12x75cl"). If not found, leave empty.
- bottleSize: Bottle size in milliliters - IMPORTANT: Look for patterns like "75cl", "750ml", "150cl", "1.5L" in the product name. Convert to ml (e.g., 75cl = 750ml, 150cl = 1500ml, 1.5L = 1500ml). If not found, leave empty.

For dates, use ISO 8601 format (YYYY-MM-DD).
For currency, use standard codes (GBP, USD, EUR, AED, etc.).
Be precise with numbers and amounts.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please extract all wine products from this invoice image. Focus on extracting each line item with product name, producer, vintage, quantity, and pricing.',
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
      // For PDFs, use file content
      const result = await generateObject({
        model: openai('gpt-4o'),
        schema: extractedDataSchema,
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting structured data from wine invoice PDFs.
Extract all wine products from the invoice with their details.
For each line item, extract:
- productName: The full wine name (e.g., "Château Margaux 2018")
- producer: The winery or producer name
- vintage: The year (e.g., "2018")
- region: The wine region (e.g., "Bordeaux", "Burgundy")
- quantity: Number of cases ordered
- unitPrice: Price per case
- total: Line item total
- caseConfig: Number of bottles per case - IMPORTANT: Look for patterns like "6x75cl", "12x75cl", "6x750ml" in the product name or description. Extract the first number (e.g., 6 from "6x75cl", 12 from "12x75cl"). If not found, leave empty.
- bottleSize: Bottle size in milliliters - IMPORTANT: Look for patterns like "75cl", "750ml", "150cl", "1.5L" in the product name. Convert to ml (e.g., 75cl = 750ml, 150cl = 1500ml, 1.5L = 1500ml). If not found, leave empty.

For dates, use ISO 8601 format (YYYY-MM-DD).
For currency, use standard codes (GBP, USD, EUR, AED, etc.).
Be precise with numbers and amounts.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please extract all wine products from this invoice PDF. Focus on extracting each line item with product name, producer, vintage, quantity, and pricing.',
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

    return {
      success: true,
      data: extractedData,
    };
  } catch (error) {
    console.error('Document extraction failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
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

export default documentsExtractInline;
