import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  cellarReleaseRequestItems,
  cellarReleaseRequests,
  wmsStock,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import notifyReleaseUpdate from '../utils/notifyReleaseUpdate';

/**
 * Change what is on a request that has not been quoted yet
 *
 * A member could add to a request and never look inside it again. Changing
 * their mind about one wine meant asking us to do it, which is a conversation
 * about something they are perfectly capable of doing themselves.
 *
 * Editable until we have priced it. After that the member is holding a figure
 * and altering what it covers would make that figure wrong — at which point
 * accepting, or asking us for revisions, are the honest options.
 */
const memberAmendRelease = stockOwnerProcedure
  .input(
    z.object({
      requestId: z.string().uuid(),
      lines: z
        .array(
          z.object({
            stockId: z.string().uuid(),
            bottles: z.number().int().min(1),
          }),
        )
        .min(1, 'A request needs at least one wine. Withdraw it instead.')
        .max(200),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [request] = await db
      .select({
        id: cellarReleaseRequests.id,
        status: cellarReleaseRequests.status,
        requestNumber: cellarReleaseRequests.requestNumber,
      })
      .from(cellarReleaseRequests)
      .where(
        and(
          eq(cellarReleaseRequests.id, input.requestId),
          eq(cellarReleaseRequests.partnerId, ctx.partner.id),
        ),
      )
      .limit(1);

    if (!request) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
    }

    if (
      !['draft', 'submitted', 'revision_requested'].includes(request.status)
    ) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'This one has been priced. Accept it, or ask us for a revision.',
      });
    }

    /*
      Re-checked against stock the member owns and how much of it is there.
      The cellar screen knows both, but a request arriving over the wire does
      not get to assert them.
    */
    const owned = await db
      .select({
        id: wmsStock.id,
        lwin18: wmsStock.lwin18,
        productName: wmsStock.productName,
        vintage: wmsStock.vintage,
        bottleSize: wmsStock.bottleSize,
        caseConfig: wmsStock.caseConfig,
        quantityCases: wmsStock.quantityCases,
        openBottles: wmsStock.openBottles,
        lotNumber: wmsStock.lotNumber,
      })
      .from(wmsStock)
      .where(
        and(
          inArray(
            wmsStock.id,
            input.lines.map((line) => line.stockId),
          ),
          eq(wmsStock.ownerId, ctx.partner.id),
        ),
      );

    const ownedById = new Map(owned.map((row) => [row.id, row]));

    for (const line of input.lines) {
      const stock = ownedById.get(line.stockId);

      if (!stock) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'One of those wines is not held in your cellar.',
        });
      }

      const available =
        stock.quantityCases * (stock.caseConfig ?? 1) + (stock.openBottles ?? 0);

      if (line.bottles > available) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `You hold ${available} ${available === 1 ? 'bottle' : 'bottles'} of ${stock.productName}.`,
        });
      }
    }

    await db
      .delete(cellarReleaseRequestItems)
      .where(eq(cellarReleaseRequestItems.requestId, request.id));

    await db.insert(cellarReleaseRequestItems).values(
      input.lines.map((line) => {
        const stock = ownedById.get(line.stockId);

        return {
          requestId: request.id,
          stockId: line.stockId,
          lotNumber: stock?.lotNumber ?? null,
          lwin18: stock?.lwin18 ?? '',
          productName: stock?.productName ?? '',
          vintage: stock?.vintage ?? null,
          bottleSize: stock?.bottleSize ?? null,
          caseConfig: stock?.caseConfig ?? null,
          bottles: line.bottles,
        };
      }),
    );

    await db
      .update(cellarReleaseRequests)
      .set({ updatedAt: new Date() })
      .where(eq(cellarReleaseRequests.id, request.id));

    if (request.status === 'submitted') {
      await notifyReleaseUpdate({
        event: 'submitted',
        amended: true,
        partnerId: ctx.partner.id,
        requestId: request.id,
        requestNumber: request.requestNumber,
      });
    }

    return { requestNumber: request.requestNumber, lines: input.lines.length };
  });

export default memberAmendRelease;
