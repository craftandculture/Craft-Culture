import { openai } from '@ai-sdk/openai';
import { AbortTaskRunError, logger, task } from '@trigger.dev/sdk';
import { generateObject } from 'ai';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { logisticsDocuments } from '@/database/schema';
import triggerDb from '@/trigger/triggerDb';

/**
 * Combined extraction schema for logistics documents
 *
 * Handles BOLs, invoices, packing lists, and other shipping documents.
 */
const logisticsExtractionSchema = z.object({
  // BOL/AWB fields
  bolNumber: z.string().optional(),
  awbNumber: z.string().optional(),
  vesselName: z.string().optional(),
  voyageNumber: z.string().optional(),
  portOfLoading: z.string().optional(),
  portOfDischarge: z.string().optional(),
  // Invoice fields
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  totalAmount: z.number().optional(),
  currency: z.string().optional(),
  // Line items
  lineItems: z
    .array(
      z.object({
        productName: z.string().optional(),
        quantity: z.number().optional(),
        cases: z.number().optional(),
        unitPrice: z.number().optional(),
        total: z.number().optional(),
        hsCode: z.string().optional(),
      }),
    )
    .optional(),
  // Raw text
  rawText: z.string().optional(),
});

type LogisticsExtractedData = z.infer<typeof logisticsExtractionSchema>;

/**
 * Get extraction prompt based on document type
 */
const getExtractionPrompt = (documentType: string): string => {
  const basePrompt = `You are an expert at extracting structured data from wine logistics documents.
Extract all relevant information from the document provided.
For dates, use ISO 8601 format (YYYY-MM-DD).
For currency, use standard currency codes (USD, EUR, GBP, AED, etc.).
Be precise with numbers, quantities, and amounts.`;

  switch (documentType) {
    case 'bill_of_lading':
      return `${basePrompt}
This is a Bill of Lading (BOL). Focus on extracting:
- BOL number, vessel name, voyage number
- Ports of loading and discharge
- Shipper and consignee details
- Any dates (departure, arrival estimates)`;

    case 'airway_bill':
      return `${basePrompt}
This is an Air Waybill (AWB). Focus on extracting:
- AWB number, flight/carrier information
- Origin and destination airports
- Shipper and consignee details
- Weight and piece count`;

    case 'commercial_invoice':
      return `${basePrompt}
This is a Commercial Invoice. Focus on extracting:
- Invoice number and date
- Line items with product names, quantities, prices
- Total amount and currency
- HS codes if present`;

    case 'packing_list':
      return `${basePrompt}
This is a Packing List. Focus on extracting:
- Total cases, bottles, weight, and volume
- Line items with product details and quantities
- Package dimensions if available`;

    default:
      return `${basePrompt}
Extract any relevant logistics information from this document, including:
- Reference numbers, dates, amounts
- Product details and quantities
- Shipping information`;
  }
};

/**
 * Extract structured data from a logistics document using AI
 *
 * This task fetches document content, sends it to OpenAI GPT-4o for
 * extraction, and updates the database with structured data.
 */
export const logisticsDocumentExtractionJob = task({
  id: 'logistics-document-extraction',
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  async run(payload: { documentId: string }) {
    const { documentId } = payload;

    logger.info('Starting logistics document extraction', { documentId });

    // Get document from database
    const document = await triggerDb.query.logisticsDocuments.findFirst({
      where: eq(logisticsDocuments.id, documentId),
    });

    if (!document) {
      throw new AbortTaskRunError(`Document ${documentId} not found`);
    }

    // Update status to processing
    await triggerDb
      .update(logisticsDocuments)
      .set({ extractionStatus: 'processing' })
      .where(eq(logisticsDocuments.id, documentId));

    try {
      // Fetch document content
      const response = await fetch(document.fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }

      const contentType = document.mimeType || response.headers.get('content-type') || '';
      const systemPrompt = getExtractionPrompt(document.documentType);

      let extractedData: LogisticsExtractedData;

      if (contentType.startsWith('image/')) {
        // For images, use vision capabilities
        const imageBuffer = await response.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const imageDataUrl = `data:${contentType};base64,${base64Image}`;

        const result = await generateObject({
          model: openai('gpt-4o'),
          schema: logisticsExtractionSchema,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Please extract all relevant logistics data from this document image.',
                },
                { type: 'image', image: imageDataUrl },
              ],
            },
          ],
        });

        extractedData = result.object;
      } else if (contentType === 'application/pdf') {
        // For PDFs, use file input
        const pdfBuffer = await response.arrayBuffer();
        const base64Pdf = Buffer.from(pdfBuffer).toString('base64');
        const pdfDataUrl = `data:application/pdf;base64,${base64Pdf}`;

        const result = await generateObject({
          model: openai('gpt-4o'),
          schema: logisticsExtractionSchema,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Please extract all relevant logistics data from this PDF document.',
                },
                { type: 'file', data: pdfDataUrl, mediaType: 'application/pdf' },
              ],
            },
          ],
        });

        extractedData = result.object;
      } else {
        throw new Error(`Unsupported content type: ${contentType}`);
      }

      logger.info('Logistics document extraction completed', {
        documentId,
        documentType: document.documentType,
        hasLineItems: !!extractedData.lineItems?.length,
        bolNumber: extractedData.bolNumber,
        invoiceNumber: extractedData.invoiceNumber,
      });

      // Update document with extracted data
      await triggerDb
        .update(logisticsDocuments)
        .set({
          extractionStatus: 'completed',
          extractedData,
          extractedAt: new Date(),
          extractionError: null,
        })
        .where(eq(logisticsDocuments.id, documentId));

      return {
        success: true,
        documentId,
        extractedData,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Logistics document extraction failed', {
        documentId,
        error: errorMessage,
      });

      // Update document with error
      await triggerDb
        .update(logisticsDocuments)
        .set({
          extractionStatus: 'failed',
          extractionError: errorMessage,
        })
        .where(eq(logisticsDocuments.id, documentId));

      throw error;
    }
  },
});
