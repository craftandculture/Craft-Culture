import { and, desc, eq, gte, inArray, ne, notInArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import inOurWarehouse from '@/app/_wms/utils/inOurWarehouse';
import partnerMovementScope from '@/app/_wms/utils/partnerMovementScope';
import db from '@/database/client';
import {
  privateClientOrderActivityLogs,
  privateClientOrders,
  sourceRfqActivityLogs,
  sourceRfqPartners,
  sourceRfqs,
  users,
  wmsStock,
  wmsStockMovements,
} from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

import getStockActivity from '../data/getStockActivity';


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
  /** Bottles moved, unsigned, so a group of picks can be totalled */
  bottles: number;
  /** The order a pick or dispatch was for (SO-00184, PCO-2026-00081) */
  orderRef: string | null;
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

/** Bottles a movement moved: its own count when recorded, else cases × pack */
const bottlesOf = (lwin18: string, cases: number, bottles: number | null) =>
  Math.abs(bottles ?? cases * (Number(lwin18.split('-')[2]) || 1));

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
      entries.push(
        ...(await getStockActivity({
          partnerId: partner.id,
          // A trade partner is never told who bought their wine
          isCollector: false,
          limit: input.limit,
        })),
      );
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
          bottles: 0,
          orderRef: null,
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
          bottles: 0,
          orderRef: null,
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

    /*
      The week at a glance, beside the feed. Out counts picks only: a dispatch
      moves the same bottles a pick already took, so counting both doubles it.
    */
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const scope = await partnerMovementScope(partner.id);

    const [weekMoves, [onHand], [inProgress]] = await Promise.all([
      scope.ownedLwins.length > 0
        ? db
            .select({
              type: wmsStockMovements.movementType,
              lwin18: wmsStockMovements.lwin18,
              cases: wmsStockMovements.quantityCases,
              bottles: wmsStockMovements.quantityBottles,
            })
            .from(wmsStockMovements)
            .where(
              and(
                scope.condition,
                inArray(wmsStockMovements.movementType, ['receive', 'pick']),
                gte(wmsStockMovements.performedAt, weekAgo),
              ),
            )
        : Promise.resolve([]),
      db
        .select({
          bottles: sql<number>`coalesce(sum(${wmsStock.quantityCases} * coalesce(${wmsStock.caseConfig}, 1) + coalesce(${wmsStock.openBottles}, 0)), 0)::int`,
          wines: sql<number>`count(distinct ${wmsStock.lwin18})::int`,
        })
        .from(wmsStock)
        .where(
          and(
            eq(wmsStock.ownerId, partner.id),
            sql`${wmsStock.quantityCases} > 0`,
            // At C&C, not wine already placed with a distributor
            inOurWarehouse(),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(privateClientOrders)
        .where(
          and(
            eq(privateClientOrders.partnerId, partner.id),
            notInArray(privateClientOrders.status, ['draft', 'delivered', 'cancelled']),
          ),
        ),
    ]);

    const weekBottles = (type: string) =>
      weekMoves
        .filter((m) => m.type === type)
        .reduce((sum, m) => sum + bottlesOf(m.lwin18, m.cases, m.bottles), 0);

    return {
      entries: entries.slice(0, input.limit),
      summary: {
        receivedBottles: weekBottles('receive'),
        outBottles: weekBottles('pick'),
        onHandBottles: Number(onHand?.bottles ?? 0),
        onHandWines: Number(onHand?.wines ?? 0),
        ordersInProgress: Number(inProgress?.count ?? 0),
      },
    };
  });

export default partnerGetActivity;
