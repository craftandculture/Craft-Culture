import { createAnthropic } from '@ai-sdk/anthropic';
import { TRPCError } from '@trpc/server';
import { generateObject } from 'ai';
import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import pdfParse from 'pdf-parse';
import { z } from 'zod';

import isTeamMember from '@/app/_teamTasks/utils/isTeamMember';
import db from '@/database/client';
import {
  logisticsDocuments,
  logisticsShipmentActivityLogs,
  logisticsShipmentCostLines,
  users,
} from '@/database/schema';
import { readStoredFileBuffer } from '@/lib/blob/privateFiles';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import isFetchableLogisticsFileUrl from '../utils/isFetchableLogisticsFileUrl';
import supersedeQuotedFreight from '../utils/quotedFreightLine';
import resolveFxToUsd from '../utils/resolveFxToUsd';
import syncShipmentCostsFromLedger from '../utils/syncShipmentCostsFromLedger';

const CATEGORIES = [
  'freight',
  'insurance',
  'origin_handling',
  'destination_handling',
  'customs',
  'gov_fees',
  'delivery',
  'transportation',
  'other',
] as const;

const extractedSchema = z.object({
  currency: z
    .string()
    .optional()
    .describe(
      '3-letter ISO 4217 code of the amounts (USD, DKK, EUR, GBP, AED, SEK, NOK...). Infer from symbols/words: kr→DKK/SEK/NOK, £→GBP, €→EUR, AED/Dhs→AED, $→USD. Always return your best guess — never "unknown".',
    ),
  vendor: z.string().optional().describe('The forwarder / vendor / issuer name on the invoice'),
  charges: z
    .array(
      z.object({
        category: z
          .enum(CATEGORIES)
          .describe(
            'freight = airfreight/sea freight; customs = clearance/export/AMS/bill of entry; gov_fees = duties/municipality; origin_handling/destination_handling = handling/pallets/collection; delivery = last-mile; other = documentation/security/misc',
          ),
        description: z.string(),
        amount: z.number(),
      }),
    )
    .describe('Every logistics charge on the invoice (numbers only)'),
});

/**
 * Parse an uploaded logistics invoice on a shipment and fill its cost-breakdown
 * fields — the single-shipment equivalent of the group invoice parser. Then
 * recompute landed cost so logistics/bottle is available immediately.
 *
 * Only documents filed by C&C staff or by the system (Hillebrand sync) are
 * read: a document a partner uploaded is skipped and reported, so nothing an
 * outside party wrote becomes a cost line without staff entering it. The rate
 * to USD is never taken from the model; a currency with no rate is skipped
 * and reported rather than converted at a guess. Each document's old lines are
 * replaced in one transaction, and every write is recorded in the shipment's
 * activity log.
 */
const adminExtractShipmentInvoice = adminProcedure
  .input(z.object({ shipmentId: z.string().uuid(), documentId: z.string().uuid().optional() }))
  .mutation(async ({ input, ctx }) => {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI parsing not configured.' });
    }

    // Parse ALL logistics invoices on the shipment (GAC + shipping + customs +
    // delivery) — not just one — and combine their charges. Commercial invoices
    // and packing lists are goods, so they're excluded.
    // `delivery_note` is the transporter's charge for the final leg and is read
    // for cost. `proof_of_delivery` is deliberately excluded: the inbound
    // delivery note we generate for a supplier is filed under it and carries no
    // charges, so feeding it to the parser would invent cost lines from a
    // document that has none.
    const LOGISTICS_TYPES = /gac|shipping|freight|customs|clearance|delivery_note|bill_of_lading|airway/i;
    const docs = await db
      .select({
        ...getTableColumns(logisticsDocuments),
        uploaderRole: users.role,
        uploaderEmail: users.email,
      })
      .from(logisticsDocuments)
      .leftJoin(users, eq(users.id, logisticsDocuments.uploadedBy))
      .where(eq(logisticsDocuments.shipmentId, input.shipmentId))
      .orderBy(desc(logisticsDocuments.createdAt));

    // Staff or system uploads only (system imports have no uploader)
    const isTrusted = (d: (typeof docs)[number]) =>
      !d.uploadedBy ||
      isTeamMember(
        d.uploaderRole && d.uploaderEmail ? { role: d.uploaderRole, email: d.uploaderEmail } : null,
      );

    const candidates = input.documentId
      ? docs.filter((d) => d.id === input.documentId)
      : docs.filter((d) => LOGISTICS_TYPES.test(d.documentType));
    const skippedPartnerDocuments = candidates.filter((d) => !isTrusted(d)).map((d) => d.fileName);
    const targetDocs = candidates.filter(isTrusted);

    if (input.documentId && candidates.length > 0 && targetDocs.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'This document was uploaded by a partner, so it is not read automatically. Check it and add the charges by hand.',
      });
    }
    if (targetDocs.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No logistics invoice to parse. Upload a freight/GAC/clearance invoice first.',
      });
    }

    const anthropic = createAnthropic({ apiKey: anthropicKey });
    const system =
      'You extract logistics charge lines from freight/clearance invoices. Return numbers only for amounts and the currency.';

    const parseOne = async (fileUrl: string, mimeType: string | null) => {
      // SSRF guard: only our Blob store or Hillebrand's document host
      if (!isFetchableLogisticsFileUrl(fileUrl)) {
        logger.error('Refusing to fetch logistics document from an unrecognised host');
        return null;
      }
      const buffer = await readStoredFileBuffer(fileUrl);
      if (!buffer) return null;
      const instruction = 'Extract every logistics charge and the currency.';
      if ((mimeType ?? '').startsWith('image/')) {
        const result = await generateObject({
          model: anthropic('claude-sonnet-4-6'),
          schema: extractedSchema,
          system,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: instruction },
                { type: 'image', image: buffer.toString('base64') },
              ],
            },
          ],
        });
        return result.object;
      }
      // PDF: use the text layer when present; otherwise (scanned/image-only PDF,
      // e.g. most GAC invoices) send the PDF to Claude to read natively.
      let text = '';
      try {
        const pdf = await pdfParse(buffer);
        text = pdf.text ?? '';
      } catch {
        text = '';
      }
      if (text.trim().length >= 500) {
        const result = await generateObject({
          model: anthropic('claude-sonnet-4-6'),
          schema: extractedSchema,
          system,
          prompt: `${instruction}\n\nINVOICE:\n${text}`,
        });
        return result.object;
      }
      const result = await generateObject({
        model: anthropic('claude-sonnet-4-6'),
        schema: extractedSchema,
        system,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: instruction },
              { type: 'file', data: buffer.toString('base64'), mediaType: 'application/pdf' },
            ],
          },
        ],
      });
      return result.object;
    };

    const round2 = (n: number) => Math.round(n * 100) / 100;
    let chargeCount = 0;
    let totalLogisticsUsd = 0;
    const currencies = new Set<string>();
    const unresolved = new Set<string>();

    for (const d of targetDocs) {
      let object: z.infer<typeof extractedSchema> | null;
      try {
        object = await parseOne(d.fileUrl, d.mimeType);
      } catch (error) {
        logger.error('Failed to parse logistics invoice', {
          documentId: d.id,
          error: error instanceof Error ? error.message : 'unknown',
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to parse ${d.fileName}. Try again, or add the charges by hand.`,
        });
      }
      if (!object) continue;
      const cur = (object.currency ?? 'USD').toUpperCase();
      currencies.add(cur);

      // The rate comes from the pegged table or the rate service, never the model
      const fx = await resolveFxToUsd(cur);
      if (fx.source === 'unresolved') {
        unresolved.add(cur);
        continue;
      }

      const rows = object.charges
        .filter((c) => (c.amount || 0) > 0)
        .map((c) => ({
          shipmentId: input.shipmentId,
          category: c.category,
          description: c.description,
          amount: c.amount || 0,
          currency: cur,
          fxToUsd: fx.rate,
          amountUsd: round2((c.amount || 0) * fx.rate),
          invoiceRef: d.documentNumber ?? null,
          vendor: object?.vendor ?? null,
          sourceDocument: d.fileName,
          createdBy: ctx.user.id,
        }));
      const documentUsd = round2(rows.reduce((sum, r) => sum + r.amountUsd, 0));

      // Re-extracting a document replaces its previous ledger lines, all or nothing
      await db.transaction(async (tx) => {
        const removed = await tx
          .delete(logisticsShipmentCostLines)
          .where(
            and(
              eq(logisticsShipmentCostLines.shipmentId, input.shipmentId),
              eq(logisticsShipmentCostLines.sourceDocument, d.fileName),
            ),
          )
          .returning({ id: logisticsShipmentCostLines.id });

        if (rows.length > 0) await tx.insert(logisticsShipmentCostLines).values(rows);

        // The billed freight replaces the accepted quote's estimate of it
        const quotedFreightRemoved = rows.some((r) => r.category === 'freight')
          ? await supersedeQuotedFreight(input.shipmentId, tx)
          : 0;

        await tx.insert(logisticsShipmentActivityLogs).values({
          shipmentId: input.shipmentId,
          userId: ctx.user.id,
          action: 'invoice_charges_extracted',
          metadata: {
            documentId: d.id,
            documentType: d.documentType,
            fileName: d.fileName,
            currency: cur,
            fxToUsd: fx.rate,
            fxSource: fx.source,
            linesReplaced: removed.length,
            linesWritten: rows.length,
            quotedFreightRemoved,
            totalUsd: documentUsd,
            lines: rows.map((r) => ({ category: r.category, description: r.description, amount: r.amount })),
          },
          notes: `${rows.length} charge line(s) read from ${d.fileName}, ${cur} at ${fx.rate} (${fx.source}), USD ${documentUsd}`,
        });
      });

      totalLogisticsUsd += documentUsd;
      chargeCount += rows.length;
    }

    // Sync the 8 cost fields from the ledger + recompute landed cost.
    await syncShipmentCostsFromLedger(input.shipmentId);

    return {
      currencies: Array.from(currencies),
      unresolvedCurrencies: Array.from(unresolved),
      totalLogisticsUsd: round2(totalLogisticsUsd),
      chargeCount,
      documentsParsed: targetDocs.length,
      skippedPartnerDocuments,
    };
  });

export default adminExtractShipmentInvoice;
