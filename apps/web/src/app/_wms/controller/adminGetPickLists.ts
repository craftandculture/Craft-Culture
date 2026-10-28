import { type AnyColumn, and, count, desc, eq, inArray, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  users,
  wmsPickLists,
  zohoInvoices,
  zohoSalesOrders,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { getPickListsSchema } from '../schemas/pickListSchema';

/**
 * Get pick lists with filtering and pagination
 *
 * @example
 *   await trpcClient.wms.admin.picking.getMany.query({});
 *   await trpcClient.wms.admin.picking.getMany.query({ status: 'pending' });
 */
const adminGetPickLists = wmsOperatorProcedure
  .input(getPickListsSchema)
  .query(async ({ input }) => {
    const { status, search, limit, offset } = input;

    /*
      Search runs here, across every pick list, not over the page already
      loaded — searching only the first 50 hid older picks entirely. Numbers
      match with or without their leading zeros, so PL-2026-00062 finds
      PL-2026-0062 and SO-182 finds SO-00182.
    */
    const term = search?.toLowerCase();
    const searchCondition = term
      ? (() => {
          const like = `%${term.replace(/[%_\\]/g, '\\$&')}%`;
          const loose = `%${term.replace(/-0+(\d)/g, '-$1').replace(/[%_\\]/g, '\\$&')}%`;
          const matches = (column: AnyColumn) =>
            sql`(lower(${column}) LIKE ${like} OR regexp_replace(lower(${column}), '-0+([0-9])', '-\\1', 'g') LIKE ${loose})`;
          return sql`(${matches(wmsPickLists.pickListNumber)}
            OR ${matches(wmsPickLists.orderNumber)}
            OR ${matches(zohoSalesOrders.customerName)}
            OR ${matches(zohoSalesOrders.referenceNumber)}
            OR EXISTS (
              SELECT 1 FROM ${zohoInvoices}
              WHERE ${zohoInvoices.referenceNumber} = ${wmsPickLists.orderNumber}
                AND ${matches(zohoInvoices.invoiceNumber)}
            ))`;
        })()
      : undefined;

    const whereConditions = and(status ? eq(wmsPickLists.status, status) : undefined, searchCondition);

    // Get pick lists with assignee info
    const pickLists = await db
      .select({
        id: wmsPickLists.id,
        pickListNumber: wmsPickLists.pickListNumber,
        status: wmsPickLists.status,
        orderId: wmsPickLists.orderId,
        orderNumber: wmsPickLists.orderNumber,
        totalItems: wmsPickLists.totalItems,
        pickedItems: wmsPickLists.pickedItems,
        assignedTo: wmsPickLists.assignedTo,
        assignedToName: users.name,
        startedAt: wmsPickLists.startedAt,
        completedAt: wmsPickLists.completedAt,
        notes: wmsPickLists.notes,
        createdAt: wmsPickLists.createdAt,
        // The date the list is sorted by, so the run order is readable.
        orderDate: zohoSalesOrders.orderDate,
        // Linked order edited in Zoho after release — drives the list badge.
        soModifiedAfterRelease: zohoSalesOrders.soModifiedAfterRelease,
        // Who the order is for, so a pick is recognised without opening it
        customerName: zohoSalesOrders.customerName,
        // A private client order's PCO number lives here
        referenceNumber: zohoSalesOrders.referenceNumber,
        // The partner's logo: matched on the Zoho contact, else on the business name
        customerLogoUrl: sql<string | null>`(
          SELECT p.logo_url FROM partners p
          WHERE p.logo_url IS NOT NULL
            AND (p.zoho_contact_id = ${zohoSalesOrders.zohoCustomerId}
              OR lower(p.business_name) = lower(${zohoSalesOrders.customerName}))
          ORDER BY (p.zoho_contact_id = ${zohoSalesOrders.zohoCustomerId}) DESC NULLS LAST
          LIMIT 1
        )`,
      })
      .from(wmsPickLists)
      .leftJoin(users, eq(wmsPickLists.assignedTo, users.id))
      .leftJoin(zohoSalesOrders, eq(wmsPickLists.orderId, zohoSalesOrders.id))
      .where(whereConditions)
      /*
        The date of the ORDER being picked, not of the pick list row. Sorting
        on the row's own timestamp meant nine picks released within the same
        few minutes came out in click order — SO-00135, 133, 134, 137, 130,
        138 — which reads as random to anyone holding the paperwork. A pick
        with no linked Zoho order falls back to when it was raised, so it
        still lands somewhere sensible rather than at the top.
      */
      .orderBy(
        sql`COALESCE(${zohoSalesOrders.orderDate}, ${wmsPickLists.createdAt}::date) DESC`,
        // Then the order number, not the pick list number — several orders
        // share a date, and this is the sequence the dispatch queue uses, so
        // the same jobs read the same way on both screens.
        desc(wmsPickLists.orderNumber),
      )
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(wmsPickLists)
      .leftJoin(zohoSalesOrders, eq(wmsPickLists.orderId, zohoSalesOrders.id))
      .where(whereConditions);

    // Get summary by status
    const statusSummary = await db
      .select({
        status: wmsPickLists.status,
        count: count(),
      })
      .from(wmsPickLists)
      .groupBy(wmsPickLists.status);

    const pendingCount =
      statusSummary.find((s) => s.status === 'pending')?.count ?? 0;
    const inProgressCount =
      statusSummary.find((s) => s.status === 'in_progress')?.count ?? 0;

    // Look up invoice numbers for the fetched pick lists
    const orderNumbers = pickLists
      .map((pl) => pl.orderNumber)
      .filter((n): n is string => !!n);

    const invoiceLookup =
      orderNumbers.length > 0
        ? await db
            .select({
              referenceNumber: zohoInvoices.referenceNumber,
              invoiceNumber: zohoInvoices.invoiceNumber,
            })
            .from(zohoInvoices)
            .where(inArray(zohoInvoices.referenceNumber, orderNumbers))
        : [];

    const invoiceMap = new Map(
      invoiceLookup.map((inv) => [inv.referenceNumber, inv.invoiceNumber]),
    );

    return {
      pickLists: pickLists.map((pl) => ({
        ...pl,
        invoiceNumber: invoiceMap.get(pl.orderNumber) ?? null,
      })),
      pagination: {
        total: countResult?.count ?? 0,
        limit,
        offset,
      },
      summary: {
        pendingCount,
        inProgressCount,
        byStatus: statusSummary,
      },
    };
  });

export default adminGetPickLists;
