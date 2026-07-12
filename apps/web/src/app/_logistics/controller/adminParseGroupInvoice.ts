import { createAnthropic } from '@ai-sdk/anthropic';
import { TRPCError } from '@trpc/server';
import { generateObject } from 'ai';
import { eq } from 'drizzle-orm';
import pdfParse from 'pdf-parse';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { costLineCategories, parseGroupInvoiceSchema } from '../schemas/shipmentGroupSchemas';

const parsedInvoiceSchema = z.object({
  vendor: z.string().optional().describe('Freight forwarder / vendor name'),
  invoiceRef: z.string().optional().describe('Invoice or proposal number'),
  invoiceDate: z.string().optional().describe('Invoice date, ISO format if possible'),
  currency: z.string().optional().describe('Main currency code, e.g. GBP, USD, EUR, AED'),
  chargeableWeightKg: z
    .number()
    .optional()
    .describe('Total chargeable / gross weight in kg (e.g. CW figure)'),
  lines: z
    .array(
      z.object({
        category: z
          .enum(costLineCategories)
          .describe(
            'Best-fit category. Pickup/collection charges = collection; airfreight/sea freight = freight; export clearance/AMS/customs = customs; pallets/handling = handling.',
          ),
        description: z.string().describe('The charge description as printed'),
        amount: z.number().describe('The line amount (numbers only)'),
        currency: z.string().optional().describe('Line currency if different from the main one'),
        scope: z
          .enum(['shared', 'shipment'])
          .describe(
            'shipment = a per-collection/per-shipment charge tied to one supplier (e.g. "Collection from Wilkinson"); shared = spread across the whole consolidation (airfreight, security, handling, documentation, MGN…)',
          ),
        shipmentMatch: z
          .string()
          .optional()
          .describe('For shipment-scoped charges, the supplier/party name, e.g. "Wilkinson", "Christies"'),
      }),
    )
    .describe('Every charge line on the invoice'),
});

/**
 * Parse an uploaded freight invoice into candidate cost lines for a group.
 * Auto-classifies each charge and, for per-collection charges, matches the
 * supplier to one of the group's shipments. Returns candidates for review —
 * nothing is saved until the user confirms.
 */
const adminParseGroupInvoice = adminProcedure
  .input(parseGroupInvoiceSchema)
  .mutation(async ({ input }) => {
    const { groupId, file: rawFile, fileType } = input;
    const file = rawFile.includes(',') ? (rawFile.split(',')[1] ?? rawFile) : rawFile;

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'AI parsing is not configured (ANTHROPIC_API_KEY missing).',
      });
    }
    const anthropic = createAnthropic({ apiKey: anthropicKey });

    const shipments = await db
      .select({
        id: logisticsShipments.id,
        shipmentNumber: logisticsShipments.shipmentNumber,
        name: logisticsShipments.name,
      })
      .from(logisticsShipments)
      .where(eq(logisticsShipments.groupId, groupId));

    const shipmentContext = shipments
      .map((s) => `- ${s.shipmentNumber}: ${s.name ?? '(no name)'}`)
      .join('\n');

    const system =
      'You extract charge lines from freight forwarder invoices for a wine importer. ' +
      'Return every charge with a best-fit category and whether it is a shared consolidation ' +
      'cost or a per-collection/per-shipment charge. Numbers only for amounts.';
    const prompt =
      `Extract all charge lines from this freight invoice.\n\n` +
      `The consolidation contains these shipments (match "Collection from X" charges to the ` +
      `closest one by supplier name):\n${shipmentContext || '(none)'}\n\n` +
      `Also capture the vendor, invoice reference, date, main currency, and total chargeable weight (kg).`;

    let object: z.infer<typeof parsedInvoiceSchema>;
    try {
      if (fileType.startsWith('image/')) {
        const result = await generateObject({
          model: anthropic('claude-sonnet-4-6'),
          schema: parsedInvoiceSchema,
          system,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image', image: file },
              ],
            },
          ],
        });
        object = result.object;
      } else {
        const pdfData = await pdfParse(Buffer.from(file, 'base64'));
        const result = await generateObject({
          model: anthropic('claude-sonnet-4-6'),
          schema: parsedInvoiceSchema,
          system,
          prompt: `${prompt}\n\nINVOICE TEXT:\n${pdfData.text}`,
        });
        object = result.object;
      }
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to parse invoice: ${error instanceof Error ? error.message : 'unknown error'}`,
      });
    }

    // Resolve per-shipment charges to a shipmentId by fuzzy name match.
    const matchShipment = (hint?: string) => {
      if (!hint) return null;
      const h = hint.toLowerCase();
      const found = shipments.find(
        (s) =>
          (s.name && (s.name.toLowerCase().includes(h) || h.includes(s.name.toLowerCase()))) ||
          s.shipmentNumber.toLowerCase().includes(h),
      );
      return found?.id ?? null;
    };

    const candidates = object.lines.map((l) => ({
      category: l.category,
      description: l.description,
      amount: l.amount,
      currency: l.currency ?? object.currency ?? 'USD',
      scope: l.scope,
      shipmentId: l.scope === 'shipment' ? matchShipment(l.shipmentMatch) : null,
      shipmentMatch: l.shipmentMatch ?? null,
    }));

    return {
      vendor: object.vendor ?? null,
      invoiceRef: object.invoiceRef ?? null,
      invoiceDate: object.invoiceDate ?? null,
      currency: object.currency ?? 'USD',
      chargeableWeightKg: object.chargeableWeightKg ?? null,
      candidates,
    };
  });

export default adminParseGroupInvoice;
