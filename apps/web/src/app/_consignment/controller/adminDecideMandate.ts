import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { saleMandateLots, saleMandates, wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import getCommittedBottles from '../data/getCommittedBottles';
import notifyMandateUpdate from '../utils/notifyMandateUpdate';

/**
 * Accept a member's offer and list it, or send it back
 *
 * Accepting is the only thing in the platform that clears `notForSale` on a
 * member's wine, which is what puts it on the trade list, the private-client
 * list and the in-app picker at once. Everything else that touches that flag
 * carries it forward from somewhere; this is where it is decided.
 *
 * The ask is the member's and is not editable here. If a price is unsellable
 * the offer goes back with a note and they re-price it — quietly listing at a
 * different number would leave the figure they agreed and the figure on the
 * shelf disagreeing, with only one of them in writing.
 */
const adminDecideMandate = adminProcedure
  .input(
    z.object({
      mandateId: z.string().uuid(),
      outcome: z.enum(['list', 'send_back', 'decline']),
      adminNotes: z.string().max(1000).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [mandate] = await db
      .select()
      .from(saleMandates)
      .where(eq(saleMandates.id, input.mandateId))
      .limit(1);

    if (!mandate) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Offer not found' });
    }

    if (mandate.status !== 'offered') {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `This offer is ${mandate.status}, not awaiting a decision.`,
      });
    }

    if (input.outcome !== 'list') {
      /*
        Sending back and declining both leave the wine on hold, because
        accepting is the only thing that ever clears it. Nothing to restore.
      */
      if (input.outcome === 'send_back' && !input.adminNotes?.trim()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Say what needs to change. The note is all the member receives.',
        });
      }

      await db
        .update(saleMandates)
        .set({
          status: input.outcome === 'decline' ? 'withdrawn' : 'draft',
          adminNotes: input.adminNotes,
          updatedAt: new Date(),
        })
        .where(eq(saleMandates.id, mandate.id));

      if (input.outcome === 'send_back') {
        await notifyMandateUpdate({
          event: 'sent_back',
          ownerId: mandate.ownerId,
          ownerName: mandate.ownerName,
          mandateId: mandate.id,
          mandateNumber: mandate.mandateNumber,
          productName: mandate.productName,
          bottles: mandate.bottlesRemaining,
          adminNotes: input.adminNotes,
        });
      }

      return { status: input.outcome };
    }

    const lots = await db
      .select()
      .from(saleMandateLots)
      .where(eq(saleMandateLots.mandateId, mandate.id));

    if (lots.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This offer covers no parcels.',
      });
    }

    /*
      Re-checked at the moment of listing, not trusted from when it was offered.
      Days may have passed; the wine may have been picked, transferred or
      counted away, and listing it would advertise stock that is not there.
    */
    const stockIds = lots.map((lot) => lot.stockId);

    const held = await db
      .select({
        id: wmsStock.id,
        productName: wmsStock.productName,
        caseConfig: wmsStock.caseConfig,
        availableCases: wmsStock.availableCases,
        openBottles: wmsStock.openBottles,
      })
      .from(wmsStock)
      .where(
        and(
          inArray(wmsStock.id, stockIds),
          eq(wmsStock.ownerId, mandate.ownerId),
        ),
      );

    const heldById = new Map(held.map((row) => [row.id, row]));

    /*
      What other mandates claim on the same parcels, this one excluded. Two
      offers over the same bottles can both be waiting here, and accepting both
      would put the same wine on the list twice.
    */
    const committed = await getCommittedBottles(stockIds, mandate.id);

    for (const lot of lots) {
      const stock = heldById.get(lot.stockId);

      if (!stock) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `${mandate.productName} is no longer held for ${mandate.ownerName}. Send the offer back so it can be re-made against what they have.`,
        });
      }

      const available =
        stock.availableCases * (stock.caseConfig ?? 1) +
        (stock.openBottles ?? 0) -
        (committed.get(lot.stockId) ?? 0);

      if (lot.bottlesRemaining > available) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Only ${available} ${available === 1 ? 'bottle' : 'bottles'} of ${stock.productName} ${available === 1 ? 'is' : 'are'} free — the rest is held or under another offer. Send this one back.`,
        });
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(wmsStock)
        .set({ notForSale: false, updatedAt: new Date() })
        .where(
          and(
            inArray(wmsStock.id, stockIds),
            eq(wmsStock.ownerId, mandate.ownerId),
          ),
        );

      await tx
        .update(saleMandates)
        .set({
          status: 'listed',
          listedAt: new Date(),
          listedBy: ctx.user.id,
          adminNotes: input.adminNotes,
          updatedAt: new Date(),
        })
        .where(eq(saleMandates.id, mandate.id));
    });

    await notifyMandateUpdate({
      event: 'listed',
      ownerId: mandate.ownerId,
      ownerName: mandate.ownerName,
      mandateId: mandate.id,
      mandateNumber: mandate.mandateNumber,
      productName: mandate.productName,
      bottles: mandate.bottlesRemaining,
    });

    return { status: 'listed' as const, mandateNumber: mandate.mandateNumber };
  });

export default adminDecideMandate;
