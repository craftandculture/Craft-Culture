import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarReleaseRequests } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import notifyReleaseUpdate from '../utils/notifyReleaseUpdate';

/**
 * Put a cost against a release request, or send it back
 *
 * Three outcomes, and only three: price it, ask for changes, or decline it.
 * The rate version the clearance figure came from is stored alongside the
 * figure, because a quote raised in March has to still be explicable in
 * September — the same reason a shipment records the FX rate it was priced at
 * rather than only the result.
 */
const adminQuoteRelease = adminProcedure
  .input(
    z.object({
      requestId: z.string().uuid(),
      outcome: z.enum(['quote', 'request_revisions', 'cancel']),
      adminNotes: z.string().max(1000).optional(),
      /** Required when quoting */
      goodsValueUsd: z.number().min(0).optional(),
      clearanceCostUsd: z.number().min(0).optional(),
      deliveryCostUsd: z.number().min(0).optional(),
      serviceFeeUsd: z.number().min(0).optional(),
      /** Anything the rate card does not foresee, with its reason */
      additionalChargeUsd: z.number().min(0).optional(),
      additionalChargeLabel: z.string().max(120).optional(),
      clearanceRateVersion: z.string().max(60).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [request] = await db
      .select({
        id: cellarReleaseRequests.id,
        partnerId: cellarReleaseRequests.partnerId,
        status: cellarReleaseRequests.status,
        requestNumber: cellarReleaseRequests.requestNumber,
      })
      .from(cellarReleaseRequests)
      .where(eq(cellarReleaseRequests.id, input.requestId))
      .limit(1);

    if (!request) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
    }

    if (request.status === 'confirmed') {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'This release has been confirmed and is being fulfilled. Amend the order instead.',
      });
    }

    if (input.outcome === 'request_revisions') {
      await db
        .update(cellarReleaseRequests)
        .set({
          status: 'revision_requested',
          adminNotes: input.adminNotes,
          updatedAt: new Date(),
        })
        .where(eq(cellarReleaseRequests.id, request.id));

      await notifyReleaseUpdate({
        event: 'revision',
        partnerId: request.partnerId,
        requestId: request.id,
        requestNumber: request.requestNumber,
        adminNotes: input.adminNotes,
      });

      return { status: 'revision_requested' as const };
    }

    if (input.outcome === 'cancel') {
      await db
        .update(cellarReleaseRequests)
        .set({
          status: 'cancelled',
          adminNotes: input.adminNotes,
          updatedAt: new Date(),
        })
        .where(eq(cellarReleaseRequests.id, request.id));

      return { status: 'cancelled' as const };
    }

    const goods = input.goodsValueUsd ?? 0;
    const clearance = input.clearanceCostUsd ?? 0;
    const delivery = input.deliveryCostUsd ?? 0;
    const service = input.serviceFeeUsd ?? 0;
    const extra = input.additionalChargeUsd ?? 0;

    if (clearance === 0 && delivery === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'A quote of nothing is not a quote. Enter the clearance and delivery costs.',
      });
    }

    await db
      .update(cellarReleaseRequests)
      .set({
        status: 'under_review',
        goodsValueUsd: goods,
        clearanceCostUsd: clearance,
        deliveryCostUsd: delivery,
        serviceFeeUsd: service,
        additionalChargeUsd: extra || null,
        additionalChargeLabel: extra ? (input.additionalChargeLabel ?? null) : null,
        totalCostUsd: clearance + delivery + service + extra,
        clearanceRateVersion: input.clearanceRateVersion,
        adminNotes: input.adminNotes,
        quotedAt: new Date(),
        quotedBy: ctx.user.id,
        updatedAt: new Date(),
      })
      .where(eq(cellarReleaseRequests.id, request.id));

    const total = clearance + delivery + service + extra;

    await notifyReleaseUpdate({
      event: 'quoted',
      partnerId: request.partnerId,
      requestId: request.id,
      requestNumber: request.requestNumber,
      totalUsd: total,
    });

    return { status: 'under_review' as const, total };
  });

export default adminQuoteRelease;
