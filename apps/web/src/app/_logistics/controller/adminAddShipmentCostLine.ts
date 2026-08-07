import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentCostLines } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import syncShipmentCostsFromLedger from '../utils/syncShipmentCostsFromLedger';

const addShipmentCostLineSchema = z.object({
  shipmentId: z.string().uuid(),
  category: z
    .enum([
      'freight',
      'insurance',
      'origin_handling',
      'destination_handling',
      'customs',
      'gov_fees',
      'delivery',
      'other',
    ])
    .default('freight'),
  description: z.string().max(300).nullable().optional(),
  amount: z.number().min(0),
  currency: z.string().min(3).max(3).default('USD'),
  fxToUsd: z.number().min(0).default(1),
  invoiceRef: z.string().max(120).nullable().optional(),
  vendor: z.string().max(200).nullable().optional(),
});

/**
 * Add a manual line to a shipment's cost ledger, then re-sync the shipment's
 * cost fields + landed cost from the ledger.
 */
const adminAddShipmentCostLine = adminProcedure
  .input(addShipmentCostLineSchema)
  .mutation(async ({ input, ctx }) => {
    await db.insert(logisticsShipmentCostLines).values({
      shipmentId: input.shipmentId,
      category: input.category,
      description: input.description ?? null,
      amount: input.amount,
      currency: input.currency.toUpperCase(),
      fxToUsd: input.fxToUsd,
      amountUsd: Math.round(input.amount * input.fxToUsd * 100) / 100,
      invoiceRef: input.invoiceRef ?? null,
      vendor: input.vendor ?? null,
      sourceDocument: 'Manual entry',
      createdBy: ctx.user.id,
    });
    await syncShipmentCostsFromLedger(input.shipmentId);
    return { ok: true };
  });

export default adminAddShipmentCostLine;
