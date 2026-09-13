import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsPartnerRequests, wmsStock } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import CONDITION_REPORT_FEE_AED from '../constants/conditionReportFee';
import generateRequestNumber from '../utils/generateRequestNumber';

/**
 * Order a condition report against wine you own
 *
 * Every bottle in the case is examined and photographed and a written report
 * follows. It is chargeable, so the fee is stated on the request itself rather
 * than left to a later invoice — a member should never be surprised by a
 * number they did not see when they asked.
 *
 * Ownership is checked against the stock row rather than taken from the
 * request: the caller supplies a stock id, and a stock id is guessable.
 */
const partnerRequestConditionReport = stockOwnerProcedure
  .input(
    z.object({
      stockId: z.string().uuid(),
      notes: z.string().max(500).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [stock] = await db
      .select({
        id: wmsStock.id,
        lwin18: wmsStock.lwin18,
        productName: wmsStock.productName,
        quantityCases: wmsStock.quantityCases,
        ownerId: wmsStock.ownerId,
      })
      .from(wmsStock)
      .where(
        and(eq(wmsStock.id, input.stockId), eq(wmsStock.ownerId, ctx.partner.id)),
      )
      .limit(1);

    if (!stock) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'That wine is not held in your cellar.',
      });
    }

    // One open request per parcel; asking twice does not mean two inspections.
    const [existing] = await db
      .select({ requestNumber: wmsPartnerRequests.requestNumber })
      .from(wmsPartnerRequests)
      .where(
        and(
          eq(wmsPartnerRequests.stockId, stock.id),
          eq(wmsPartnerRequests.requestType, 'condition_report'),
          eq(wmsPartnerRequests.status, 'pending'),
        ),
      )
      .limit(1);

    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `A condition report is already open for this wine (${existing.requestNumber}).`,
      });
    }

    const requestNumber = await generateRequestNumber();

    const [request] = await db
      .insert(wmsPartnerRequests)
      .values({
        requestNumber,
        requestType: 'condition_report',
        status: 'pending',
        partnerId: ctx.partner.id,
        requestedBy: ctx.user.id,
        stockId: stock.id,
        lwin18: stock.lwin18,
        productName: stock.productName,
        quantityCases: stock.quantityCases,
        partnerNotes: [
          `Condition report requested. Fee AED ${CONDITION_REPORT_FEE_AED} per case.`,
          input.notes?.trim(),
        ]
          .filter(Boolean)
          .join(' — '),
      })
      .returning();

    return {
      requestNumber: request?.requestNumber ?? requestNumber,
      feeAed: CONDITION_REPORT_FEE_AED * stock.quantityCases,
      cases: stock.quantityCases,
    };
  });

export default partnerRequestConditionReport;
