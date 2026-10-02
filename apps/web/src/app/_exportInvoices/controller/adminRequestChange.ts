import { createAnthropic } from '@ai-sdk/anthropic';
import { TRPCError } from '@trpc/server';
import { generateObject } from 'ai';
import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import loadExportInvoice from '../data/loadExportInvoice';
import houseRules from '../houseRules';
import { exportOpSchema } from '../schemas/exportOpSchema';
import applyExportOps from '../utils/applyExportOps';
import deriveDocumentTotals from '../utils/deriveDocumentTotals';

const proposalSchema = z.object({
  explanation: z
    .string()
    .describe('One or two plain sentences for the operator: what will change, or why it cannot.'),
  needsZohoChange: z
    .boolean()
    .describe('True when the request needs the Zoho invoice reissued (money or quantities) rather than an edit here.'),
  ops: z.array(exportOpSchema).describe('The edits that carry out the request. Empty if it cannot be done here.'),
  standingRuleCandidate: z
    .boolean()
    .describe('True if this is something the consignee is likely to want on every export invoice, e.g. always show ABV.'),
});

/**
 * Turn a request in plain words into proposed edits
 *
 * "Customs want ABV on each line", "show the case count as 80", "add the PCO
 * numbers". Claude sees the document and the house rules and answers with
 * edit ops, which are dry-run here: an op that would not apply is caught now,
 * and nothing is saved until the operator accepts the proposal. Requests that
 * would move money come back as needing a Zoho change, with no ops.
 */
const adminRequestChange = adminProcedure
  .input(z.object({ id: z.string().uuid(), request: z.string().min(3).max(2000) }))
  .mutation(async ({ input }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'AI is not configured.' });

    const { row, document } = await loadExportInvoice(input.id);
    if (row.status !== 'draft') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'An issued export invoice cannot be changed.' });
    }

    const totals = deriveDocumentTotals(document);
    const compact = {
      header: document.header,
      totals: { cases: totals.cases, bottles: totals.bottles, total: totals.total },
      sections: document.sections,
      extraColumns: document.extraColumns,
      notes: document.notes,
      declaration: document.declaration,
      lines: document.lines.map((l, i) => ({
        lineNo: i + 1,
        id: l.id,
        sectionId: l.sectionId,
        kind: l.kind,
        description: l.description,
        hsCode: l.hsCode,
        origin: l.origin,
        pack: `${l.packBottles}x${l.bottleSizeCl}cl`,
        qty: l.qty,
        unitPrice: l.unitPrice,
        amount: l.amount,
        boe: l.boe,
        extra: l.extra,
        components: l.components.map((c) => c.description),
      })),
    };

    let proposal;
    try {
      const anthropic = createAnthropic({ apiKey });
      const result = await generateObject({
        model: anthropic('claude-sonnet-5'),
        schema: proposalSchema,
        system: `You edit export invoices for a fine-wine exporter by proposing typed edit ops. Use line ids (not line numbers) in ops. Only use information in the document or given by the user; if a value is needed that you do not have (e.g. ABV per wine), add the column and fill only what you know, and say what is missing. Follow these rules strictly:\n\n${houseRules}`,
        prompt: `DOCUMENT:\n${JSON.stringify(compact)}\n\nREQUEST FROM THE OPERATOR:\n${input.request}`,
      });
      proposal = result.object;
    } catch (error) {
      logger.error('Export change request failed', { error, id: input.id });
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not work out that change. Try rewording it.' });
    }

    let applyError: string | null = null;
    try {
      applyExportOps(document, proposal.ops);
    } catch (error) {
      applyError = error instanceof Error ? error.message : 'The proposed change does not apply.';
    }

    return { ...proposal, applyError };
  });

export default adminRequestChange;
