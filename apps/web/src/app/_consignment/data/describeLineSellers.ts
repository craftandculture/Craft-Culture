import { inArray } from 'drizzle-orm';

import getCraftCultureOwnerIds from '@/app/_partners/data/getCraftCultureOwnerIds';
import db from '@/database/client';
import { partners, wmsStock } from '@/database/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type LineSellerKind = 'house' | 'member' | 'partner';

export interface LineSeller {
  kind: LineSellerKind;
  ownerId: string | null;
  /** Who the line settles to, for staff. Never shown to the buyer. */
  label: string;
}

interface PurchaseLine {
  id: string;
  stockId: string;
  sellerPartnerId: string | null;
  mandateId: string | null;
}

/**
 * Who each line of a cellar purchase settles to
 *
 * One answer for the three places that ask: confirming the payment writes the
 * debt, the purchases screen says who is owed, and reversing removes it.
 *
 * - **member** — sold through their offer, owed their ask
 * - **house** — C&C's own stock, or stock C&C bought outright, owes nobody
 * - **partner** — anyone else's consignment, owed at landed cost
 *
 * @param lines - The purchase lines
 * @param executor - An open transaction, when called inside one
 * @returns The seller of each line, keyed by line id
 */
const describeLineSellers = async (
  lines: PurchaseLine[],
  executor: Tx | typeof db = db,
) => {
  const sellerIds = [
    ...new Set(
      lines
        .map((line) => line.sellerPartnerId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [names, arrangements] = await Promise.all([
    sellerIds.length
      ? executor
          .select({ id: partners.id, name: partners.businessName })
          .from(partners)
          .where(inArray(partners.id, sellerIds))
      : Promise.resolve([]),
    lines.length
      ? executor
          .select({
            id: wmsStock.id,
            salesArrangement: wmsStock.salesArrangement,
          })
          .from(wmsStock)
          .where(
            inArray(
              wmsStock.id,
              lines.map((line) => line.stockId),
            ),
          )
      : Promise.resolve([]),
  ]);

  const nameOf = new Map(names.map((row) => [row.id, row.name]));
  // C&C by id, never by name: a member's cellar can carry any name
  const houseIds = await getCraftCultureOwnerIds();
  const arrangementOf = new Map(
    arrangements.map((row) => [row.id, row.salesArrangement]),
  );

  return new Map<string, LineSeller>(
    lines.map((line) => {
      if (line.mandateId) {
        return [
          line.id,
          { kind: 'member', ownerId: line.sellerPartnerId, label: 'A member' },
        ];
      }

      const name = line.sellerPartnerId
        ? (nameOf.get(line.sellerPartnerId) ?? null)
        : null;

      const ours =
        !line.sellerPartnerId ||
        houseIds.has(line.sellerPartnerId) ||
        arrangementOf.get(line.stockId) === 'purchased';

      return [
        line.id,
        ours
          ? { kind: 'house', ownerId: line.sellerPartnerId, label: 'C&C' }
          : {
              kind: 'partner',
              ownerId: line.sellerPartnerId,
              label: name ?? 'A partner',
            },
      ];
    }),
  );
};

export default describeLineSellers;
