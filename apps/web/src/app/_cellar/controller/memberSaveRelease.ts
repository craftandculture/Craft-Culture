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

import EDITABLE_STATUSES from '../utils/editableStatuses';
import generateReleaseNumber from '../utils/generateReleaseNumber';

/**
 * Create or amend a draft release request
 *
 * The whole line set is sent each time and replaces what was there. A member
 * adding a wine, changing a quantity and removing another is one intention,
 * and treating it as three separate operations invites a half-applied basket
 * if one of them fails.
 *
 * Every line is checked against stock the member actually owns, and against
 * how much of it is there — the cellar screen already knows both, but a
 * request arriving over the wire does not get to assert them.
 */
const memberSaveRelease = stockOwnerProcedure
  .input(
    z.object({
      requestId: z.string().uuid().optional(),
      deliveryAddress: z.string().max(500).optional(),
      memberNotes: z.string().max(1000).optional(),
      lines: z
        .array(
          z.object({
            stockId: z.string().uuid(),
            bottles: z.number().int().min(1),
          }),
        )
        .min(1, 'Choose at least one wine')
        .max(200),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const stockIds = input.lines.map((line) => line.stockId);

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
      })
      .from(wmsStock)
      .where(
        and(
          inArray(wmsStock.id, stockIds),
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

    let requestId = input.requestId;

    if (requestId) {
      const [existing] = await db
        .select({
          id: cellarReleaseRequests.id,
          status: cellarReleaseRequests.status,
        })
        .from(cellarReleaseRequests)
        .where(
          and(
            eq(cellarReleaseRequests.id, requestId),
            eq(cellarReleaseRequests.partnerId, ctx.partner.id),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
      }

      if (
        !EDITABLE_STATUSES.includes(
          existing.status as (typeof EDITABLE_STATUSES)[number],
        )
      ) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            'This request is with us for review and can no longer be changed.',
        });
      }

      await db
        .update(cellarReleaseRequests)
        .set({
          deliveryAddress: input.deliveryAddress,
          memberNotes: input.memberNotes,
          updatedAt: new Date(),
        })
        .where(eq(cellarReleaseRequests.id, requestId));

      await db
        .delete(cellarReleaseRequestItems)
        .where(eq(cellarReleaseRequestItems.requestId, requestId));
    } else {
      const [created] = await db
        .insert(cellarReleaseRequests)
        .values({
          requestNumber: await generateReleaseNumber(),
          partnerId: ctx.partner.id,
          requestedBy: ctx.user.id,
          status: 'draft',
          deliveryAddress: input.deliveryAddress,
          memberNotes: input.memberNotes,
        })
        .returning({ id: cellarReleaseRequests.id });

      requestId = created?.id;
    }

    if (!requestId) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not save that request',
      });
    }

    await db.insert(cellarReleaseRequestItems).values(
      input.lines.map((line) => {
        const stock = ownedById.get(line.stockId);

        return {
          requestId,
          stockId: line.stockId,
          lwin18: stock?.lwin18 ?? '',
          productName: stock?.productName ?? '',
          vintage: stock?.vintage ?? null,
          bottleSize: stock?.bottleSize ?? null,
          caseConfig: stock?.caseConfig ?? null,
          bottles: line.bottles,
        };
      }),
    );

    return { requestId };
  });

export default memberSaveRelease;
