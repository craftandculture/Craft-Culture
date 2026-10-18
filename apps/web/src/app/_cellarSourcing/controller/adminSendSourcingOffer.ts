import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';
import db from '@/database/client';
import { cellarSourcingRequests, partners } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import notifySourcingUpdate from '../data/notifySourcingUpdate';

/**
 * The team offers a member the wine they asked for
 *
 * One offer per request: sending another replaces the first, including after
 * a decline. The price is the wine's price per bottle and nothing else.
 *
 * "From our UAE stock" means accepting reserves it from the pool at once at
 * this price, so it needs the LWIN-18 of the stock row; otherwise acceptance
 * opens a Team Tasks job to buy it.
 *
 * @example
 *   await trpcClient.cellarSourcing.admin.sendOffer.mutate({ requestId, wineName, caseConfig: 6, cases: 1, pricePerBottleUsd: 420, holdAt: 'uae', fromStock: false });
 */
const adminSendSourcingOffer = staffAdminProcedure
  .input(
    z
      .object({
        requestId: z.string().uuid(),
        wineName: z.string().trim().min(2).max(200),
        lwin18: z.string().trim().max(40).optional(),
        vintage: z.number().int().min(1800).max(2100).optional(),
        caseConfig: z.number().int().min(1).max(24),
        cases: z.number().int().min(1).max(500),
        pricePerBottleUsd: z.number().positive().max(1_000_000),
        holdAt: z.enum(['uae', 'uk']),
        validUntil: z.date().optional(),
        note: z.string().trim().max(1000).optional(),
        fromStock: z.boolean(),
      })
      .refine((value) => !value.fromStock || Boolean(value.lwin18), {
        message: 'Wine from our stock needs its LWIN-18',
        path: ['lwin18'],
      })
      .refine((value) => !value.fromStock || value.holdAt === 'uae', {
        message: 'Only wine in our UAE warehouse can be reserved from stock',
        path: ['fromStock'],
      }),
  )
  .mutation(async ({ ctx, input }) => {
    const [row] = await db
      .update(cellarSourcingRequests)
      .set({
        status: 'offer_sent',
        offerWineName: input.wineName,
        offerLwin18: input.lwin18 ? normalizeLwin18(input.lwin18) : null,
        offerVintage: input.vintage ?? null,
        offerCaseConfig: input.caseConfig,
        offerCases: input.cases,
        offerPricePerBottleUsd: input.pricePerBottleUsd,
        offerHoldAt: input.holdAt,
        offerValidUntil: input.validUntil ?? null,
        offerNote: input.note || null,
        offerFromStock: input.fromStock,
        offeredAt: new Date(),
        offeredBy: ctx.user.id,
        respondedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(cellarSourcingRequests.id, input.requestId),
          inArray(cellarSourcingRequests.status, [
            'requested',
            'searching',
            'offer_sent',
            'declined',
          ]),
        ),
      )
      .returning();

    if (!row) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This request has already been accepted, withdrawn or closed.',
      });
    }

    const [partner] = await db
      .select({ name: partners.businessName })
      .from(partners)
      .where(eq(partners.id, row.partnerId))
      .limit(1);

    await notifySourcingUpdate({
      event: 'offer_sent',
      requestId: row.id,
      requestNumber: row.requestNumber,
      partnerId: row.partnerId,
      memberName: partner?.name ?? 'Member',
      wineName: input.wineName,
    });

    return { requestNumber: row.requestNumber };
  });

export default adminSendSourcingOffer;
