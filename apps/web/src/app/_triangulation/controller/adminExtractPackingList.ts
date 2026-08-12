import { createAnthropic } from '@ai-sdk/anthropic';
import { TRPCError } from '@trpc/server';
import { type ModelMessage, generateObject } from 'ai';
import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import { extractPackingListSchema } from '../schemas/triangulationSchemas';

/**
 * What a packing list states, line by line.
 *
 * Quantities stay exactly as printed — cases and bottles-per-case separately —
 * because the pack size is what converts the line to bottles, and inferring a
 * total here would bury the assumption where nobody can check it.
 */
const packingListResultSchema = z.object({
  documentRef: z
    .string()
    .optional()
    .describe('Packing list, invoice or shipment reference number'),
  documentDate: z
    .string()
    .optional()
    .describe('Date on the document as YYYY-MM-DD, if one is printed'),
  lines: z
    .array(
      z.object({
        code: z
          .string()
          .optional()
          .describe(
            'Product code exactly as printed — W code, supplier SKU or item reference',
          ),
        productName: z.string().describe('Full product name: producer, wine, region'),
        vintage: z.string().optional().describe('Vintage year, 4 digits'),
        quantityCases: z
          .number()
          .describe('Number of cases of this line, exactly as stated'),
        caseConfig: z
          .number()
          .optional()
          .describe('Bottles per case, only when the document states or implies it'),
        bottleSize: z.string().optional().describe('Bottle size as printed, e.g. 75cl'),
        lwin: z.string().optional().describe('LWIN code if one is printed'),
      }),
    )
    .describe('Every product line on the document, across all pages'),
});

const SYSTEM_PROMPT = `You transcribe wine shipment packing lists.

This is a TRANSCRIPTION task, not an interpretation task. Copy what the document
says. Do not correct, normalise, translate or tidy product names — they are
matched against a product registry downstream, and a "corrected" name will fail
to match.

Rules:
- Extract every product line, across every page. Do not summarise or truncate.
- Quantities: give cases and bottles-per-case separately, exactly as stated.
  Never multiply them together. If the document gives a total bottle count and
  no case count, put the bottle count in quantityCases and set caseConfig to 1.
- Only state caseConfig when the document says or clearly shows it (e.g. a
  "6x75cl" format column). Leave it out rather than assuming a house default —
  a wrong pack size silently multiplies the error six-fold.
- Ignore totals rows, subtotals, pallet summaries and freight lines.
- If a value is not printed, leave the field out rather than guessing.`;

/**
 * Read a shipment packing list into triangulation import lines
 *
 * Opening stock for the original Crurated shipment predates WMS receiving, so
 * there is no receipt ledger to sync from — the packing list PDFs are the only
 * record of what arrived. This lifts them into the same shape a spreadsheet
 * upload produces, so the rows land in the ordinary preview-and-map flow rather
 * than a separate path.
 *
 * Extraction is a starting point, not an authority: the wizard shows every row
 * for review before anything is saved, and the mapping queue catches any code
 * that doesn't resolve.
 */
const adminExtractPackingList = adminProcedure
  .input(extractPackingListSchema)
  .mutation(async ({ input }) => {
    const { file, mediaType, fileName } = input;

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Document extraction is not configured — ANTHROPIC_API_KEY is missing.',
      });
    }

    const anthropic = createAnthropic({ apiKey });

    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Transcribe every product line from this wine shipment packing list${
              fileName ? ` (${fileName})` : ''
            }.`,
          },
          mediaType === 'application/pdf'
            ? { type: 'file', data: file, mediaType: 'application/pdf' }
            : { type: 'image', image: file },
        ],
      },
    ];

    try {
      const result = await generateObject({
        // Opus for this one: a misread quantity or pack size corrupts the
        // opening stock every later figure is measured against, and these
        // documents are read once.
        model: anthropic('claude-opus-5'),
        schema: packingListResultSchema,
        system: SYSTEM_PROMPT,
        messages,
        // Room for a long multi-page list plus the model's own reasoning —
        // both are drawn from this budget.
        maxOutputTokens: 32000,
      });

      const { documentRef, documentDate, lines } = result.object;

      if (lines.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message:
            'No product lines were found in that document. Check it is a packing list rather than a cover sheet.',
        });
      }

      return {
        documentRef: documentRef ?? null,
        documentDate: documentDate ?? null,
        lines,
        // Surfaced so the reviewer knows which rows need a pack size supplied
        // before the bottle figures mean anything.
        linesWithoutPack: lines.filter((line) => !line.caseConfig).length,
        linesWithoutCode: lines.filter((line) => !line.code).length,
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      logger.error('[Triangulation] Packing list extraction failed', {
        error,
        fileName,
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message:
          'Could not read that document. A clearer scan, or an Excel/CSV version, usually works.',
      });
    }
  });

export default adminExtractPackingList;
