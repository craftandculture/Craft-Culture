import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import partnerMovementScope from '@/app/_wms/utils/partnerMovementScope';
import db from '@/database/client';
import {
  privateClientOrderActivityLogs,
  privateClientOrders,
  sourceRfqActivityLogs,
  sourceRfqPartners,
  sourceRfqs,
  users,
  wmsLocations,
  wmsStockMovements,
} from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';


/** The three things that happen to a partner, in one shape. */
export interface PartnerActivityEntry {
  id: string;
  /** Which stream it came from, so the UI can mark it. */
  stream: 'stock' | 'order' | 'rfq';
  at: Date;
  /** "Picked", "Order submitted" — what happened, in a couple of words. */
  title: string;
  /** The wine, the order number, the RFQ — what it happened to. */
  subject: string;
  /** Where, how much, who: the line under the title. */
  detail: string | null;
  /** A reference someone can quote back at us. */
  reference: string | null;
}

const STOCK_TITLES: Record<string, string> = {
  receive: 'Received',
  putaway: 'Put away',
  transfer: 'Moved',
  pick: 'Picked',
  repack_in: 'From an opened case',
  repack_out: 'Made into other packs',
  adjust: 'Adjusted',
  count: 'Counted',
  dispatch: 'Dispatched',
};

/** `awaiting_client_payment` → `Awaiting client payment`. */
const humanise = (value: string | null) =>
  value
    ? value.replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase())
    : null;

/**
 * Everything that has happened to a wine partner, in one list.
 *
 * Three streams answer to the same question — "what has been going on?" — and
 * a partner should not have to visit three screens and reconcile the
 * timestamps themselves: stock in the warehouse, their private-client orders,
 * and the RFQs they were invited to.
 *
 * Each stream is scoped independently and then merged by time. Stock uses the
 * shared movement scope, which is careful about wines two owners hold; orders
 * and RFQs are scoped on the partner the record belongs to, not the partner
 * who happened to act, so a change C&C made to their order still shows on
 * their feed — it happened to them either way.
 *
 * @param input - How many entries, and an optional stream filter
 * @returns Entries newest first, in one shape whatever they came from
 */
const partnerGetActivity = winePartnerProcedure
  .input(
    z.object({
      streams: z.array(z.enum(['stock', 'order', 'rfq'])).optional(),
      limit: z.number().min(1).max(200).default(60),
    }),
  )
  .query(async ({ input, ctx: { partner } }) => {
    const wanted = new Set(input.streams?.length ? input.streams : ['stock', 'order', 'rfq']);
    const entries: PartnerActivityEntry[] = [];

    if (wanted.has('stock')) {
      const scope = await partnerMovementScope(partner.id);

      if (scope.ownedLwins.length > 0) {
        const fromLocation = db
          .select({ id: wmsLocations.id, code: wmsLocations.locationCode })
          .from(wmsLocations)
          .as('from_location');
        const toLocation = db
          .select({ id: wmsLocations.id, code: wmsLocations.locationCode })
          .from(wmsLocations)
          .as('to_location');

        const rows = await db
          .select({
            id: wmsStockMovements.id,
            movementNumber: wmsStockMovements.movementNumber,
            movementType: wmsStockMovements.movementType,
            productName: wmsStockMovements.productName,
            quantityCases: wmsStockMovements.quantityCases,
            quantityBottles: wmsStockMovements.quantityBottles,
            fromLocation: fromLocation.code,
            toLocation: toLocation.code,
            performedAt: wmsStockMovements.performedAt,
          })
          .from(wmsStockMovements)
          .leftJoin(fromLocation, eq(wmsStockMovements.fromLocationId, fromLocation.id))
          .leftJoin(toLocation, eq(wmsStockMovements.toLocationId, toLocation.id))
          .where(
            and(
              scope.condition,
              inArray(wmsStockMovements.movementType, [
                'receive',
                'putaway',
                'transfer',
                'pick',
                'repack_in',
                'repack_out',
                'adjust',
                'count',
                'dispatch',
              ]),
            ),
          )
          .orderBy(desc(wmsStockMovements.performedAt))
          .limit(input.limit);

        entries.push(
          ...rows.map((row) => ({
            id: `stock-${row.id}`,
            stream: 'stock' as const,
            at: row.performedAt,
            title: STOCK_TITLES[row.movementType] ?? row.movementType,
            subject: row.productName,
            detail: [
              row.quantityCases ? `${row.quantityCases} cs` : null,
              row.quantityBottles ? `${row.quantityBottles} btl` : null,
              row.fromLocation && row.toLocation
                ? `${row.fromLocation} → ${row.toLocation}`
                : row.fromLocation
                  ? `from ${row.fromLocation}`
                  : row.toLocation
                    ? `into ${row.toLocation}`
                    : null,
            ]
              .filter(Boolean)
              .join(' · '),
            reference: row.movementNumber,
          })),
        );
      }
    }

    if (wanted.has('order')) {
      const rows = await db
        .select({
          id: privateClientOrderActivityLogs.id,
          action: privateClientOrderActivityLogs.action,
          newStatus: privateClientOrderActivityLogs.newStatus,
          notes: privateClientOrderActivityLogs.notes,
          createdAt: privateClientOrderActivityLogs.createdAt,
          orderNumber: privateClientOrders.orderNumber,
          clientName: privateClientOrders.clientName,
          actor: users.name,
        })
        .from(privateClientOrderActivityLogs)
        .innerJoin(
          privateClientOrders,
          eq(privateClientOrderActivityLogs.orderId, privateClientOrders.id),
        )
        .leftJoin(users, eq(privateClientOrderActivityLogs.userId, users.id))
        // The order's partner, not the actor's — a change C&C made to their
        // order still happened to them.
        .where(eq(privateClientOrders.partnerId, partner.id))
        .orderBy(desc(privateClientOrderActivityLogs.createdAt))
        .limit(input.limit);

      entries.push(
        ...rows.map((row) => ({
          id: `order-${row.id}`,
          stream: 'order' as const,
          at: row.createdAt,
          title: humanise(row.newStatus) ?? humanise(row.action) ?? 'Updated',
          subject: `${row.orderNumber} · ${row.clientName}`,
          detail: row.notes,
          reference: row.orderNumber,
        })),
      );
    }

    if (wanted.has('rfq')) {
      const rows = await db
        .select({
          id: sourceRfqActivityLogs.id,
          action: sourceRfqActivityLogs.action,
          newStatus: sourceRfqActivityLogs.newStatus,
          notes: sourceRfqActivityLogs.notes,
          createdAt: sourceRfqActivityLogs.createdAt,
          rfqNumber: sourceRfqs.rfqNumber,
          name: sourceRfqs.name,
        })
        .from(sourceRfqActivityLogs)
        .innerJoin(sourceRfqs, eq(sourceRfqActivityLogs.rfqId, sourceRfqs.id))
        // Only RFQs this partner was actually invited to.
        .innerJoin(
          sourceRfqPartners,
          and(
            eq(sourceRfqPartners.rfqId, sourceRfqs.id),
            eq(sourceRfqPartners.partnerId, partner.id),
          ),
        )
        .orderBy(desc(sourceRfqActivityLogs.createdAt))
        .limit(input.limit);

      entries.push(
        ...rows.map((row) => ({
          id: `rfq-${row.id}`,
          stream: 'rfq' as const,
          at: row.createdAt,
          title: humanise(row.newStatus) ?? humanise(row.action) ?? 'Updated',
          subject: `${row.rfqNumber}${row.name ? ` · ${row.name}` : ''}`,
          detail: row.notes,
          reference: row.rfqNumber,
        })),
      );
    }

    /*
      Merged after the fact rather than in SQL. Three tables with different
      shapes would need a UNION with padded columns, which is harder to read
      and no faster at this size — each stream is already capped.
    */
    entries.sort((left, right) => right.at.getTime() - left.at.getTime());

    return { entries: entries.slice(0, input.limit) };
  });

export default partnerGetActivity;
