import { TRPCError } from '@trpc/server';
import { and, count, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarSourcingRequests } from '@/database/schema';
import { collectorProcedure } from '@/lib/trpc/procedures';

import notifySourcingUpdate from '../data/notifySourcingUpdate';
import generateSourcingNumber from '../utils/generateSourcingNumber';

/** Open requests a member may have at once, so the queue stays workable */
const MAX_OPEN_REQUESTS = 10;

/**
 * A member asks us to find a wine
 *
 * Not gated on activation: asking costs nothing and commits nobody. Agreeing
 * to what we find is where the gate sits.
 *
 * @example
 *   await trpcClient.cellarSourcing.member.createRequest.mutate({ wineName: 'Rousseau Chambertin', bottles: 6, holdAt: 'uae' });
 */
const memberCreateSourcingRequest = collectorProcedure
  .input(
    z.object({
      lwin: z.string().trim().max(20).optional(),
      wineName: z.string().trim().min(2, 'Tell us which wine').max(200),
      vintages: z.string().trim().max(100).optional(),
      bottles: z.number().int().min(1).max(1200),
      format: z.string().trim().max(40).optional(),
      budgetPerBottleUsd: z.number().positive().max(1_000_000).optional(),
      holdAt: z.enum(['uae', 'uk']),
      notes: z.string().trim().max(1000).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [open] = await db
      .select({ value: count() })
      .from(cellarSourcingRequests)
      .where(
        and(
          eq(cellarSourcingRequests.partnerId, ctx.partner.id),
          inArray(cellarSourcingRequests.status, [
            'requested',
            'searching',
            'offer_sent',
          ]),
        ),
      );

    if ((open?.value ?? 0) >= MAX_OPEN_REQUESTS) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'We are already looking for several wines for you. Please let us come back to you on those first, or contact us directly.',
      });
    }

    let created: { id: string; requestNumber: string } | undefined;

    for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
      const requestNumber = await generateSourcingNumber(db, attempt);
      try {
        const [row] = await db
          .insert(cellarSourcingRequests)
          .values({
            requestNumber,
            partnerId: ctx.partner.id,
            lwin: input.lwin || null,
            wineName: input.wineName,
            vintages: input.vintages || null,
            bottles: input.bottles,
            format: input.format || null,
            budgetPerBottleUsd: input.budgetPerBottleUsd ?? null,
            holdAt: input.holdAt,
            notes: input.notes || null,
            createdBy: ctx.user.id,
          })
          .returning({
            id: cellarSourcingRequests.id,
            requestNumber: cellarSourcingRequests.requestNumber,
          });
        created = row;
      } catch (error) {
        const isClash =
          typeof error === 'object' &&
          error !== null &&
          (error as { code?: string }).code === '23505';
        if (!isClash || attempt === 2) throw error;
      }
    }

    if (!created) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not send that request',
      });
    }

    await notifySourcingUpdate({
      event: 'requested',
      requestId: created.id,
      requestNumber: created.requestNumber,
      partnerId: ctx.partner.id,
      memberName: ctx.partner.businessName,
      wineName: input.wineName,
    });

    return created;
  });

export default memberCreateSourcingRequest;
