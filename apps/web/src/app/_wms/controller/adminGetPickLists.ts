import { count, desc, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { users, wmsPickLists, zohoInvoices } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getPickListsSchema } from '../schemas/pickListSchema';

/**
 * Get pick lists with filtering and pagination
 *
 * @example
 *   await trpcClient.wms.admin.picking.getMany.query({});
 *   await trpcClient.wms.admin.picking.getMany.query({ status: 'pending' });
 */
const adminGetPickLists = adminProcedure
  .input(getPickListsSchema)
  .query(async ({ input }) => {
    const { status, limit, offset } = input;

    // Build where conditions
    const whereConditions = status ? eq(wmsPickLists.status, status) : undefined;

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
      })
      .from(wmsPickLists)
      .leftJoin(users, eq(wmsPickLists.assignedTo, users.id))
      .where(whereConditions)
      .orderBy(desc(wmsPickLists.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(wmsPickLists)
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
