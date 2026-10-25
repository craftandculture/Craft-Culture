import { and, eq, inArray } from 'drizzle-orm';

import { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';
import db from '@/database/client';
import { partners, saleMandates } from '@/database/schema';

/** Mandate states in which a member's wine may be sold, or is being */
const SELLING_STATUSES = [
  'offered',
  'listed',
  'placed',
  'partially_sold',
  'sold',
] as const;

/**
 * Which of these stock rows are a Private Cellar member's wine that is not for
 * sale, and so must not go out on a trade order
 *
 * A collector's bottles are theirs to keep. They leave on the member's own
 * delivery, or when the member has offered that wine for sale; nothing else.
 * In October 2026, 75 of Ihab Toma's bottles were picked for trade sales
 * orders because release suggested, and the scanner accepted, whichever bay
 * held the wine regardless of whose it was. Release and pick both ask this.
 *
 * @example
 *   const holds = await getCollectorStockHolds(candidates);
 *   const pickable = candidates.filter((row) => !holds.isHeld(row));
 *
 * @param rows - Stock rows, with their owner and LWIN18
 * @returns isHeld(row), and the member's name for the message to the picker
 */
const getCollectorStockHolds = async (
  rows: { ownerId: string | null; lwin18: string }[],
) => {
  const ownerIds = [
    ...new Set(rows.map((row) => row.ownerId).filter((id): id is string => !!id)),
  ];

  const collectors = ownerIds.length
    ? await db
        .select({ id: partners.id, name: partners.businessName })
        .from(partners)
        .where(
          and(
            inArray(partners.id, ownerIds),
            eq(partners.type, 'private_collector'),
          ),
        )
    : [];
  const collectorNames = new Map(collectors.map((row) => [row.id, row.name]));

  const offered = collectors.length
    ? await db
        .select({ ownerId: saleMandates.ownerId, lwinKey: saleMandates.lwinKey })
        .from(saleMandates)
        .where(
          and(
            inArray(saleMandates.ownerId, [...collectorNames.keys()]),
            inArray(saleMandates.status, [...SELLING_STATUSES]),
          ),
        )
    : [];
  const offeredKeys = new Set(
    offered.map((row) => `${row.ownerId}|${row.lwinKey}`),
  );

  const isHeld = (row: { ownerId: string | null; lwin18: string }) =>
    !!row.ownerId &&
    collectorNames.has(row.ownerId) &&
    !offeredKeys.has(`${row.ownerId}|${lwinPakKeyOf(row.lwin18)}`);

  const ownerNameOf = (ownerId: string | null) =>
    (ownerId && collectorNames.get(ownerId)) ?? 'a Private Cellar member';

  return { isHeld, ownerNameOf };
};

export default getCollectorStockHolds;
