import { and, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm';

import db from '@/database/client';
import {
  cellarAllocationInterests,
  cellarAllocations,
  cellarSourcingRequests,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

/** Statuses where the offer on a request is the member's business */
const OFFER_VISIBLE = ['offer_sent', 'accepted', 'declined'];

/**
 * A member's wine requests and the allocations open to them
 *
 * Guarded: the tables are new, and a missed migration should hide these
 * panels rather than break Available now.
 *
 * Another member's interest is never returned, nor how much demand there is,
 * nor the total behind an allocation: a member sees what they may ask for.
 *
 * @example
 *   const { requests, allocations } = await trpcClient.cellarSourcing.member.get.query();
 */
const memberGetSourcing = stockOwnerProcedure.query(async ({ ctx }) => {
  try {
    const now = new Date();

    const requestRows = await db
      .select()
      .from(cellarSourcingRequests)
      .where(eq(cellarSourcingRequests.partnerId, ctx.partner.id))
      .orderBy(desc(cellarSourcingRequests.createdAt))
      .limit(50);

    const requests = requestRows.map((row) => {
      const showOffer = OFFER_VISIBLE.includes(row.status);
      const isExpired =
        row.status === 'offer_sent' &&
        row.offerValidUntil !== null &&
        row.offerValidUntil <= now;

      return {
        id: row.id,
        requestNumber: row.requestNumber,
        wineName: row.wineName,
        vintages: row.vintages,
        bottles: row.bottles,
        format: row.format,
        budgetPerBottleUsd: row.budgetPerBottleUsd,
        holdAt: row.holdAt,
        notes: row.notes,
        status: isExpired ? 'offer_expired' : row.status,
        staffNote: row.staffNote,
        createdAt: row.createdAt,
        offer: showOffer
          ? {
              wineName: row.offerWineName ?? row.wineName,
              vintage: row.offerVintage,
              caseConfig: row.offerCaseConfig ?? 1,
              cases: row.offerCases ?? 0,
              pricePerBottleUsd: row.offerPricePerBottleUsd ?? 0,
              holdAt: row.offerHoldAt ?? row.holdAt,
              validUntil: row.offerValidUntil,
              note: row.offerNote,
            }
          : null,
      };
    });

    const mine = await db
      .select()
      .from(cellarAllocationInterests)
      .where(eq(cellarAllocationInterests.partnerId, ctx.partner.id));

    const mineIds = mine.map((interest) => interest.allocationId);

    const allocationRows = await db
      .select({
        id: cellarAllocations.id,
        wineName: cellarAllocations.wineName,
        producer: cellarAllocations.producer,
        vintage: cellarAllocations.vintage,
        format: cellarAllocations.format,
        caseConfig: cellarAllocations.caseConfig,
        pricePerBottleUsd: cellarAllocations.pricePerBottleUsd,
        maxCasesPerMember: cellarAllocations.maxCasesPerMember,
        closesAt: cellarAllocations.closesAt,
        deliveryNote: cellarAllocations.deliveryNote,
        description: cellarAllocations.description,
        holdAt: cellarAllocations.holdAt,
        status: cellarAllocations.status,
      })
      .from(cellarAllocations)
      .where(
        or(
          and(
            eq(cellarAllocations.status, 'open'),
            or(
              isNull(cellarAllocations.closesAt),
              gt(cellarAllocations.closesAt, now),
            ),
          ),
          mineIds.length > 0
            ? inArray(cellarAllocations.id, mineIds)
            : undefined,
        ),
      )
      .orderBy(desc(cellarAllocations.createdAt))
      .limit(20);

    const allocations = allocationRows
      .map((row) => {
        const interest = mine.find((item) => item.allocationId === row.id);

        return {
          ...row,
          isOpen:
            row.status === 'open' &&
            (row.closesAt === null || row.closesAt > now),
          myInterest: interest
            ? {
                id: interest.id,
                casesRequested: interest.casesRequested,
                casesAllocated: interest.casesAllocated,
                status: interest.status,
              }
            : null,
        };
      })
      /* A closed offer the member never asked for is of no interest to them */
      .filter(
        (row) =>
          row.isOpen ||
          (row.myInterest && row.myInterest.status !== 'withdrawn'),
      );

    return { requests, allocations };
  } catch (error) {
    logger.error('Could not read cellar sourcing', { error });
    return { requests: [], allocations: [] };
  }
});

export default memberGetSourcing;
