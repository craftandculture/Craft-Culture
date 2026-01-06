import { createOpenAI } from '@ai-sdk/openai';
import { TRPCError } from '@trpc/server';
import { generateObject } from 'ai';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { sourceRfqItems, sourceRfqs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import parseInputSchema from '../schemas/parseInputSchema';

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

    // Update RFQ status to parsing
    await db
      .update(sourceRfqs)
      .set({
        status: 'parsing',
        sourceType: inputType,
        sourceFileName: fileName,
        rawInputText: content,
      })
      .where(eq(sourceRfqs.id, rfqId));

    // Check for OpenAI key
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
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

      const userPrompt = inputType === 'excel'
        ? `Parse the following Excel/spreadsheet data and extract all wine products:\n\n${content}`
        : `Parse the following email text and extract all wine products:\n\n${content}`;

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

      // Insert parsed items into database
      const itemValues = extractedItems.map((item, index) => ({
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
          itemCount: extractedItems.length,
          parsedAt: new Date(),
          parsingError: null,
        })
        .where(eq(sourceRfqs.id, rfqId));

      return {
        success: true,
        message: `Successfully parsed ${extractedItems.length} items`,
        items: extractedItems,
      };
    } catch (error) {
      console.error('AI parsing failed:', error);

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
        message: `Failed to parse input: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  });

export default adminParseInput;
