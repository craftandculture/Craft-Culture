import { and, desc, eq, inArray, ne } from 'drizzle-orm';
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
  /**
   * What sort of event, for the icon and for folding: stock arriving (`in`),
   * leaving (`out`), warehouse housekeeping a partner rarely needs to read
   * (`internal`: bay moves, put-away, repacks), stock-count corrections
   * (`correction`), and order or RFQ updates (`update`).
   */
  kind: 'in' | 'out' | 'internal' | 'correction' | 'update';
  /** "2 bottles", "7 cases · 42 btl", "−1 case": the quantity, in words */
  quantity: string | null;
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

/** Stock movements in a partner's words, and the kind each one is */
const STOCK_EVENTS: Record<string, { title: string; kind: PartnerActivityEntry['kind'] }> = {
  receive: { title: 'Received', kind: 'in' },
  putaway: { title: 'Put away', kind: 'internal' },
  transfer: { title: 'Moved bay', kind: 'internal' },
  pick: { title: 'Picked for an order', kind: 'out' },
  repack_in: { title: 'Repacked', kind: 'internal' },
  repack_out: { title: 'Repacked', kind: 'internal' },
  adjust: { title: 'Stock corrected', kind: 'correction' },
  count: { title: 'Stock count correction', kind: 'correction' },
  dispatch: { title: 'Dispatched', kind: 'out' },
};

/**
 * A movement's quantity in words
 *
 * The pack is the third segment of the code. Single-bottle stock is counted
 * in bottles — "2 cs · 2 btl" for two loose bottles read as two cases. A
 * count correction keeps its sign, so a removal reads as one.
 */
const quantityOf = (lwin18: string, cases: number, bottles: number | null) => {
  const pack = Number(lwin18.split('-')[2]) || 0;
  const plural = (n: number, word: string) => `${n} ${word}${Math.abs(n) === 1 ? '' : 's'}`;
  const sign = cases < 0 ? '−' : '';
  const n = Math.abs(cases);

  if (pack === 1) return `${sign}${plural(n || Math.abs(bottles ?? 0), 'bottle')}`;
  if (n === 0 && bottles) return plural(Math.abs(bottles), 'bottle');
  if (n === 0) return null;
  return `${sign}${plural(n, 'case')}${bottles && bottles !== n ? ` · ${Math.abs(bottles)} btl` : ''}`;
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
            lwin18: wmsStockMovements.lwin18,
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
          ...rows.map((row) => {
            const event = STOCK_EVENTS[row.movementType] ?? {
              title: row.movementType,
              kind: 'internal' as const,
            };
            return {
              id: `stock-${row.id}`,
              stream: 'stock' as const,
              kind: event.kind,
              at: row.performedAt,
              title: event.title,
              subject: row.productName,
              quantity: quantityOf(row.lwin18, row.quantityCases, row.quantityBottles),
              // Bays mean little to a partner; kept as the small print
              detail:
                row.fromLocation && row.toLocation
                  ? `${row.fromLocation} → ${row.toLocation}`
                  : row.fromLocation
                    ? `from ${row.fromLocation}`
                    : row.toLocation
                      ? `into ${row.toLocation}`
                      : null,
              reference: row.movementNumber,
            };
          }),
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
        .where(
          and(
            eq(privateClientOrders.partnerId, partner.id),
            // C&C-only notes never reach the partner
            ne(privateClientOrderActivityLogs.action, 'internal_note_added'),
          ),
        )
        .orderBy(desc(privateClientOrderActivityLogs.createdAt))
        .limit(input.limit);

      entries.push(
        ...rows.map((row) => ({
          id: `order-${row.id}`,
          stream: 'order' as const,
          kind: 'update' as const,
          quantity: null,
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
          kind: 'update' as const,
          quantity: null,
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
