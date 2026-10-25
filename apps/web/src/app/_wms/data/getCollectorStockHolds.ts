import { and, inArray } from 'drizzle-orm';

import { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';
import db from '@/database/client';
import { partners, saleMandates } from '@/database/schema';

/** Mandate states in which an owner's wine may be sold, or is being */
const SELLING_STATUSES = [
  'offered',
  'listed',
  'placed',
  'partially_sold',
  'sold',
] as const;

/**
 * Which of these stock rows are held for their owner, and so must not go out
 * on a trade order
 *
 * A row marked not for sale is the owner's to keep: it leaves on their own
 * delivery, or once they have offered that wine for sale, and nothing else.
 * In October 2026, 75 of Ihab Toma's bottles — every one of his rows marked
 * not for sale — were picked for trade sales orders, because release
 * suggested, and the scanner accepted, whichever bay held the wine. Release
 * and pick both ask this. Consigned cellars (not marked) sell as before.
 *
 * @example
 *   const holds = await getCollectorStockHolds(candidates);
 *   const pickable = candidates.filter((row) => !holds.isHeld(row));
 *
 * @param rows - Stock rows, with their owner, LWIN18 and not-for-sale flag
 * @returns isHeld(row), and the owner's name for the message to the picker
 */
const getCollectorStockHolds = async (
  rows: { ownerId: string | null; lwin18: string; notForSale: boolean | null }[],
) => {
  const ownerIds = [
    ...new Set(
      rows
        .filter((row) => row.notForSale)
        .map((row) => row.ownerId)
        .filter((id): id is string => !!id),
    ),
  ];

  const [owners, offered] = ownerIds.length
    ? await Promise.all([
        db
          .select({ id: partners.id, name: partners.businessName })
          .from(partners)
          .where(inArray(partners.id, ownerIds)),
        db
          .select({ ownerId: saleMandates.ownerId, lwinKey: saleMandates.lwinKey })
          .from(saleMandates)
          .where(
            and(
              inArray(saleMandates.ownerId, ownerIds),
              inArray(saleMandates.status, [...SELLING_STATUSES]),
            ),
          ),
      ])
    : [[], []];

  const ownerNames = new Map(owners.map((row) => [row.id, row.name]));
  const offeredKeys = new Set(
    offered.map((row) => `${row.ownerId}|${row.lwinKey}`),
  );

  const isHeld = (row: {
    ownerId: string | null;
    lwin18: string;
    notForSale: boolean | null;
  }) =>
    !!row.notForSale &&
    !offeredKeys.has(`${row.ownerId}|${lwinPakKeyOf(row.lwin18)}`);

  const ownerNameOf = (ownerId: string | null) =>
    (ownerId && ownerNames.get(ownerId)) ?? 'its owner';

  return { isHeld, ownerNameOf };
};

export default getCollectorStockHolds;
