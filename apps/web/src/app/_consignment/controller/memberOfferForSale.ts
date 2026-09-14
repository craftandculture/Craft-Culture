import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';
import db from '@/database/client';
import { saleMandateLots, saleMandates, wmsStock } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import generateMandateNumber from '../utils/generateMandateNumber';

/**
 * A member instructs C&C to sell wine on their behalf
 *
 * Ownership does not move. The member keeps the wine through the whole chain
 * and is paid when it sells; what this changes is that it may now be sold, and
 * that C&C may place it with a distributor to do so.
 *
 * **That second part is the member's point of no return, and it happens here.**
 * Placement is C&C's call and needs no further approval, so from the moment
 * this succeeds the wine can be put beyond recall without the member being
 * asked again. The screen that calls this has to say so before they confirm.
 *
 * One mandate per wine, not per basket: each is then listed, priced, placed
 * and sold on its own timetable, and we may well want one wine and not another
 * from the same offer.
 *
 * @example
 *   await trpcClient.consignment.member.offerForSale.mutate({
 *     lines: [{ stockId, bottles: 6 }],
 *     askPerBottleUsd: 210,
 *   });
 */
const memberOfferForSale = stockOwnerProcedure
  .input(
    z.object({
      lines: z
        .array(
          z.object({
            stockId: z.string().uuid(),
            bottles: z.number().int().min(1),
          }),
        )
        .min(1, 'Choose at least one parcel')
        .max(50),
      /** What the member receives per bottle, before C&C's commission is added */
      askPerBottleUsd: z.number().positive().max(1_000_000),
      expiresAt: z.string().nullable().optional(),
      ownerNotes: z.string().max(1000).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const stockIds = input.lines.map((line) => line.stockId);

    /*
      Scoped to the caller's own stock in the query, not checked afterwards. A
      stock id is guessable, and fetching first then comparing leaves a window
      and leaks what exists through the error message.
    */
    const owned = await db
      .select()
      .from(wmsStock)
      .where(
        and(inArray(wmsStock.id, stockIds), eq(wmsStock.ownerId, ctx.partner.id)),
      );

    const ownedById = new Map(owned.map((row) => [row.id, row]));

    /*
      Every parcel in one offer must be the same wine, because a mandate carries
      one ask. The cellar sends one wine at a time; this is the guard that keeps
      that true if anything else ever calls it.
    */
    const lwins = new Set(owned.map((row) => row.lwin18));

    if (lwins.size > 1) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'One offer covers one wine. Offer the others separately.',
      });
    }

    for (const line of input.lines) {
      const stock = ownedById.get(line.stockId);

      if (!stock) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'One of those parcels is not held in your cellar.',
        });
      }

      /*
        Availability, not the total. Cases already committed to somebody's order
        are not the member's to offer, and finding that out at the point of sale
        would mean withdrawing an offer a buyer had already accepted.
      */
      const available =
        stock.availableCases * (stock.caseConfig ?? 1) + (stock.openBottles ?? 0);

      if (line.bottles > available) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${available} ${available === 1 ? 'bottle' : 'bottles'} of ${stock.productName} ${available === 1 ? 'is' : 'are'} available to offer.`,
        });
      }
    }

    const first = owned[0];

    if (!first) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'One of those parcels is not held in your cellar.',
      });
    }

    const totalBottles = input.lines.reduce((sum, line) => sum + line.bottles, 0);

    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

    const mandateNumber = await generateMandateNumber();

    const mandateId = await db.transaction(async (tx) => {
      const [mandate] = await tx
        .insert(saleMandates)
        .values({
          mandateNumber,
          ownerId: ctx.partner.id,
          ownerName: ctx.partner.businessName,
          lwin18: first.lwin18,
          lwinKey: lwinPakKeyOf(first.lwin18),
          productName: first.productName,
          producer: first.producer,
          vintage: first.vintage,
          bottleSize: first.bottleSize,
          caseConfig: first.caseConfig,
          bottlesOffered: totalBottles,
          bottlesRemaining: totalBottles,
          askPerBottleUsd: input.askPerBottleUsd,
          /*
            Offered, not listed. C&C reviews before anything reaches a price
            list, and the hold flag stays on until it does — so an offer that is
            never accepted never makes the wine sellable.
          */
          status: 'offered',
          offeredAt: new Date(),
          expiresAt:
            expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
          ownerNotes: input.ownerNotes,
          createdBy: ctx.user.id,
        })
        .returning({ id: saleMandates.id });

      if (!mandate) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not record that offer',
        });
      }

      await tx.insert(saleMandateLots).values(
        input.lines.map((line) => {
          const stock = ownedById.get(line.stockId);

          return {
            mandateId: mandate.id,
            stockId: line.stockId,
            locationId: stock?.locationId,
            lotNumber: stock?.lotNumber ?? null,
            shipmentId: stock?.shipmentId ?? null,
            reExportBoeNumber: stock?.reExportBoeNumber ?? null,
            bottlesOffered: line.bottles,
            bottlesRemaining: line.bottles,
            /*
              Recorded now, while it is still true. Withdrawal restores this
              rather than assuming the wine was sellable — most of a private
              cellar is held for its owner, and guessing would list it.
            */
            previousNotForSale: stock?.notForSale ?? true,
          };
        }),
      );

      return mandate.id;
    });

    return { mandateId, mandateNumber, bottles: totalBottles };
  });

export default memberOfferForSale;
