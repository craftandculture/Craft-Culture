import { openai } from '@ai-sdk/openai';
import { AbortTaskRunError, logger, task } from '@trigger.dev/sdk';
import { generateObject } from 'ai';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { privateClientOrderDocuments } from '@/database/schema';
import triggerDb from '@/trigger/triggerDb';

/**
 * Schema for extracted invoice data
 */
const extractedDataSchema = z.object({
  invoiceNumber: z.string().optional().describe('Invoice number or reference'),
  invoiceDate: z.string().optional().describe('Invoice date in ISO format'),
  totalAmount: z.number().optional().describe('Total invoice amount'),
  currency: z.string().optional().describe('Currency code (e.g., AED, USD)'),
  lineItems: z
    .array(
      z.object({
        productName: z.string().optional().describe('Product name or description'),
        quantity: z.number().optional().describe('Quantity ordered'),
        unitPrice: z.number().optional().describe('Price per unit'),
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
    .optional()
    .describe('Line items from the invoice'),
  paymentReference: z.string().optional().describe('Payment reference or transaction ID'),
  rawText: z.string().optional().describe('Raw text extracted from the document'),
});

type ExtractedData = z.infer<typeof extractedDataSchema>;

/**
 * Extract structured data from a document using AI
 *
 * This task fetches document content from Vercel Blob, sends it to OpenAI for
 * extraction, and updates the database with structured invoice data.
 */
export const extractDocumentJob = task({
  id: 'extract-document',
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  async run(payload: { documentId: string }) {
    const { documentId } = payload;

    logger.info('Starting document extraction', { documentId });

    // Get document from database
    const document = await triggerDb.query.privateClientOrderDocuments.findFirst({
      where: { id: documentId },
    });

    if (!document) {
      throw new AbortTaskRunError(`Document ${documentId} not found`);
    }

    // Update status to processing
    await triggerDb
      .update(privateClientOrderDocuments)
      .set({ extractionStatus: 'processing' })
      .where(eq(privateClientOrderDocuments.id, documentId));

    try {
      // Fetch document content from Vercel Blob
      const response = await fetch(document.fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }

      const contentType = document.mimeType || response.headers.get('content-type') || '';

      // Prepare content for AI based on file type
      let extractedData: ExtractedData;

      if (contentType.startsWith('image/')) {
        // For images, use vision capabilities
        const imageBuffer = await response.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const imageDataUrl = `data:${contentType};base64,${base64Image}`;

        const result = await generateObject({
          model: openai('gpt-4o'),
          schema: extractedDataSchema,
          messages: [
            {
              role: 'system',
              content: `You are an expert at extracting structured data from wine invoice images.
Extract all relevant information from the invoice image provided.
For each line item, also extract:
- caseConfig: Number of bottles per case - IMPORTANT: Look for patterns like "6x75cl", "12x75cl", "6x750ml" in the product name or description. Extract the first number (e.g., 6 from "6x75cl", 12 from "12x75cl"). If not found, leave empty.
- bottleSize: Bottle size in milliliters - IMPORTANT: Look for patterns like "75cl", "750ml", "150cl", "1.5L" in the product name. Convert to ml (e.g., 75cl = 750ml, 150cl = 1500ml, 1.5L = 1500ml). If not found, leave empty.
For dates, use ISO 8601 format (YYYY-MM-DD).
For currency, use standard currency codes (AED, USD, EUR, GBP, etc.).
Be precise with numbers and amounts.`,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Please extract all invoice data from this image, including invoice number, date, line items, and totals.',
                },
                {
                  type: 'image',
                  image: imageDataUrl,
                },
              ],
            },
          ],
        });

        extractedData = result.object;
      } else if (contentType === 'application/pdf') {
        // For PDFs, fetch as base64 and use vision
        const pdfBuffer = await response.arrayBuffer();
        const base64Pdf = Buffer.from(pdfBuffer).toString('base64');
        const pdfDataUrl = `data:application/pdf;base64,${base64Pdf}`;

        const result = await generateObject({
          model: openai('gpt-4o'),
          schema: extractedDataSchema,
          messages: [
            {
              role: 'system',
              content: `You are an expert at extracting structured data from wine invoice PDFs.
Extract all relevant information from the invoice PDF provided.
For each line item, also extract:
- caseConfig: Number of bottles per case - IMPORTANT: Look for patterns like "6x75cl", "12x75cl", "6x750ml" in the product name or description. Extract the first number (e.g., 6 from "6x75cl", 12 from "12x75cl"). If not found, leave empty.
- bottleSize: Bottle size in milliliters - IMPORTANT: Look for patterns like "75cl", "750ml", "150cl", "1.5L" in the product name. Convert to ml (e.g., 75cl = 750ml, 150cl = 1500ml, 1.5L = 1500ml). If not found, leave empty.
For dates, use ISO 8601 format (YYYY-MM-DD).
For currency, use standard currency codes (AED, USD, EUR, GBP, etc.).
Be precise with numbers and amounts.`,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Please extract all invoice data from this PDF, including invoice number, date, line items, and totals.',
                },
                {
                  type: 'file',
                  data: pdfDataUrl,
                  mediaType: 'application/pdf',
                },
              ],
            },
          ],
        });

        extractedData = result.object;
      } else {
        throw new Error(`Unsupported content type: ${contentType}`);
      }

      logger.info('Document extraction completed', {
        documentId,
        hasLineItems: !!extractedData.lineItems?.length,
        invoiceNumber: extractedData.invoiceNumber,
      });

      // Update document with extracted data
      await triggerDb
        .update(privateClientOrderDocuments)
        .set({
          extractionStatus: 'completed',
          extractedData,
          extractedAt: new Date(),
          extractionError: null,
        })
        .where(eq(privateClientOrderDocuments.id, documentId));

      return {
        success: true,
        documentId,
        extractedData,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Document extraction failed', {
        documentId,
        error: errorMessage,
      });

      // Update document with error
      await triggerDb
        .update(privateClientOrderDocuments)
        .set({
          extractionStatus: 'failed',
          extractionError: errorMessage,
        })
        .where(eq(privateClientOrderDocuments.id, documentId));

      throw error;
    }
  },
});
