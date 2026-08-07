import { createAnthropic } from '@ai-sdk/anthropic';
import { TRPCError } from '@trpc/server';
import { generateObject } from 'ai';
import { desc, eq } from 'drizzle-orm';
import pdfParse from 'pdf-parse';
import { z } from 'zod';

import db from '@/database/client';
import {
  logisticsDocuments,
  logisticsShipmentItems,
  logisticsShipments,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import calculateLandedCost from '../utils/calculateLandedCost';

/** USD-pegged currencies convert at a fixed rate; others need the LLM's rate. */
const PEGGED: Record<string, number> = {
  USD: 1,
  AED: 0.2723,
  SAR: 0.2667,
  QAR: 0.2747,
  BHD: 2.6539,
  OMR: 2.6008,
};

const CATEGORIES = [
  'freight',
  'insurance',
  'origin_handling',
  'destination_handling',
  'customs',
  'gov_fees',
  'delivery',
  'other',
] as const;

const extractedSchema = z.object({
  currency: z.string().optional().describe('Main currency code, e.g. AED, USD, GBP, EUR'),
  fxToUsd: z
    .number()
    .optional()
    .describe('Rate to convert the currency to USD (1 if already USD). Only needed for non-pegged currencies.'),
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
 */
const adminExtractShipmentInvoice = adminProcedure
  .input(z.object({ shipmentId: z.string().uuid(), documentId: z.string().uuid().optional() }))
  .mutation(async ({ input }) => {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI parsing not configured.' });
    }

    // Parse ALL logistics invoices on the shipment (GAC + shipping + customs +
    // delivery) — not just one — and combine their charges. Commercial invoices
    // and packing lists are goods, so they're excluded.
    const LOGISTICS_TYPES = /gac|shipping|freight|customs|clearance|delivery|bill_of_lading|airway/i;
    const docs = await db
      .select()
      .from(logisticsDocuments)
      .where(eq(logisticsDocuments.shipmentId, input.shipmentId))
      .orderBy(desc(logisticsDocuments.createdAt));
    const targetDocs = input.documentId
      ? docs.filter((d) => d.id === input.documentId)
      : docs.filter((d) => LOGISTICS_TYPES.test(d.documentType));
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
      const fileRes = await fetch(fileUrl);
      if (!fileRes.ok) return null;
      const buffer = Buffer.from(await fileRes.arrayBuffer());
      const instruction = 'Extract every logistics charge, the currency and (if not USD) the FX to USD.';
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
      const pdf = await pdfParse(buffer);
      const result = await generateObject({
        model: anthropic('claude-sonnet-4-6'),
        schema: extractedSchema,
        system,
        prompt: `${instruction}\n\nINVOICE:\n${pdf.text}`,
      });
      return result.object;
    };

    // Sum charges (in USD, per-document FX) into the shipment's 8 cost buckets.
    const buckets: Record<(typeof CATEGORIES)[number], number> = {
      freight: 0,
      insurance: 0,
      origin_handling: 0,
      destination_handling: 0,
      customs: 0,
      gov_fees: 0,
      delivery: 0,
      other: 0,
    };
    let chargeCount = 0;
    let anyFloating = false;
    const currencies = new Set<string>();
    for (const d of targetDocs) {
      let object: z.infer<typeof extractedSchema> | null;
      try {
        object = await parseOne(d.fileUrl, d.mimeType);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to parse ${d.fileName}: ${error instanceof Error ? error.message : 'unknown'}`,
        });
      }
      if (!object) continue;
      const cur = (object.currency ?? 'USD').toUpperCase();
      const fx = PEGGED[cur] ?? object.fxToUsd ?? 1;
      if (!(cur in PEGGED) && cur !== 'USD') anyFloating = true;
      currencies.add(cur);
      for (const c of object.charges) {
        buckets[c.category] += (c.amount || 0) * fx;
        chargeCount += 1;
      }
    }
    const round2 = (n: number) => Math.round(n * 100) / 100;

    await db
      .update(logisticsShipments)
      .set({
        freightCostUsd: round2(buckets.freight),
        insuranceCostUsd: round2(buckets.insurance),
        originHandlingUsd: round2(buckets.origin_handling),
        destinationHandlingUsd: round2(buckets.destination_handling),
        customsClearanceUsd: round2(buckets.customs),
        govFeesUsd: round2(buckets.gov_fees),
        deliveryCostUsd: round2(buckets.delivery),
        otherCostsUsd: round2(buckets.other),
        updatedAt: new Date(),
      })
      .where(eq(logisticsShipments.id, input.shipmentId));

    // Recompute landed cost + per-item allocation so logistics/bottle is live.
    const [shipment] = await db
      .select()
      .from(logisticsShipments)
      .where(eq(logisticsShipments.id, input.shipmentId));
    const items = await db
      .select()
      .from(logisticsShipmentItems)
      .where(eq(logisticsShipmentItems.shipmentId, input.shipmentId));
    if (shipment && items.length > 0) {
      const result = calculateLandedCost(shipment, items);
      await db
        .update(logisticsShipments)
        .set({ totalLandedCostUsd: result.totalLandedCost, updatedAt: new Date() })
        .where(eq(logisticsShipments.id, input.shipmentId));
      for (const r of result.items) {
        await db
          .update(logisticsShipmentItems)
          .set({
            freightAllocated: r.freightAllocated,
            landedCostTotal: r.landedCostTotal,
            landedCostPerBottle: r.landedCostPerBottle,
            updatedAt: new Date(),
          })
          .where(eq(logisticsShipmentItems.id, r.itemId));
      }
    }

    const totalLogisticsUsd = round2(Object.values(buckets).reduce((s, v) => s + v, 0));
    return {
      currencies: Array.from(currencies),
      anyFloating,
      totalLogisticsUsd,
      chargeCount,
      documentsParsed: targetDocs.length,
      buckets: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, round2(v)])),
    };
  });

export default adminExtractShipmentInvoice;
