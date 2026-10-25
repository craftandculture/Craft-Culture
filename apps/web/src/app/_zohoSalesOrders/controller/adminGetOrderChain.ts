import { desc, eq, inArray, or } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  cellarReleaseRequests,
  partners,
  privateClientOrders,
  wmsDispatchBatches,
  wmsPickLists,
  zohoInvoices,
  zohoSalesOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

export interface OrderChainStep {
  key: 'release' | 'pco' | 'salesOrder' | 'invoice' | 'pick' | 'dispatch' | 'delivered';
  label: string;
  reference: string | null;
  status: string | null;
  at: Date | null;
  href: string | null;
  done: boolean;
}

/**
 * The whole paperwork chain behind one delivery or client order
 *
 * Release → PCO → Zoho sales order → invoice → pick list → dispatch →
 * delivered, from whichever of them you start at, through the stored links
 * (never the Reference text). A step with nothing behind it is returned empty
 * so the screen can show exactly where the chain breaks.
 *
 * @example
 *   await trpcClient.zohoSalesOrders.getChain.query({ pcoId });
 */
const adminGetOrderChain = adminProcedure
  .input(
    z
      .object({
        releaseId: z.string().uuid().optional(),
        pcoId: z.string().uuid().optional(),
        salesOrderId: z.string().uuid().optional(),
      })
      .refine((v) => v.releaseId || v.pcoId || v.salesOrderId, {
        message: 'Give a release, PCO or sales order',
      }),
  )
  .query(async ({ input }) => {
    // Resolve to the PCO, the hub every other link hangs from
    let pcoId = input.pcoId ?? null;
    let release: {
      id: string;
      requestNumber: string;
      status: string;
      memberName: string | null;
      at: Date | null;
      pcoId: string | null;
    } | null = null;

    const releaseSelect = {
      id: cellarReleaseRequests.id,
      requestNumber: cellarReleaseRequests.requestNumber,
      status: cellarReleaseRequests.status,
      memberName: partners.businessName,
      at: cellarReleaseRequests.confirmedAt,
      pcoId: cellarReleaseRequests.privateClientOrderId,
    };

    if (input.releaseId) {
      [release = null] = await db
        .select(releaseSelect)
        .from(cellarReleaseRequests)
        .leftJoin(partners, eq(partners.id, cellarReleaseRequests.partnerId))
        .where(eq(cellarReleaseRequests.id, input.releaseId));
      pcoId = release?.pcoId ?? null;
    }

    let startSalesOrder: { pcoId: string | null } | undefined;
    if (!pcoId && input.salesOrderId) {
      [startSalesOrder] = await db
        .select({ pcoId: zohoSalesOrders.privateClientOrderId })
        .from(zohoSalesOrders)
        .where(eq(zohoSalesOrders.id, input.salesOrderId));
      pcoId = startSalesOrder?.pcoId ?? null;
    }

    const [pco] = pcoId
      ? await db
          .select({
            id: privateClientOrders.id,
            orderNumber: privateClientOrders.orderNumber,
            status: privateClientOrders.status,
            orderKind: privateClientOrders.orderKind,
            createdAt: privateClientOrders.createdAt,
            deliveredAt: privateClientOrders.deliveredAt,
            zohoSalesOrderId: privateClientOrders.zohoSalesOrderId,
          })
          .from(privateClientOrders)
          .where(eq(privateClientOrders.id, pcoId))
      : [];

    if (pco && !release) {
      [release = null] = await db
        .select(releaseSelect)
        .from(cellarReleaseRequests)
        .leftJoin(partners, eq(partners.id, cellarReleaseRequests.partnerId))
        .where(eq(cellarReleaseRequests.privateClientOrderId, pco.id));
    }

    // Every SO behind the PCO, or the one we started from
    const soConditions = [
      pco ? eq(zohoSalesOrders.privateClientOrderId, pco.id) : undefined,
      pco?.zohoSalesOrderId
        ? eq(zohoSalesOrders.zohoSalesOrderId, pco.zohoSalesOrderId)
        : undefined,
      input.salesOrderId ? eq(zohoSalesOrders.id, input.salesOrderId) : undefined,
    ].filter(Boolean);
    const salesOrders = soConditions.length
      ? await db
          .select({
            id: zohoSalesOrders.id,
            number: zohoSalesOrders.salesOrderNumber,
            status: zohoSalesOrders.status,
            customerName: zohoSalesOrders.customerName,
            invoiceNumber: zohoSalesOrders.invoiceNumber,
            pickListId: zohoSalesOrders.pickListId,
            dispatchBatchId: zohoSalesOrders.dispatchBatchId,
            orderDate: zohoSalesOrders.orderDate,
          })
          .from(zohoSalesOrders)
          .where(or(...soConditions))
          .orderBy(desc(zohoSalesOrders.orderDate))
      : [];
    const salesOrder = salesOrders[0];

    const [invoice] = salesOrder?.invoiceNumber
      ? await db
          .select({
            number: zohoInvoices.invoiceNumber,
            status: zohoInvoices.status,
            date: zohoInvoices.invoiceDate,
            balance: zohoInvoices.balance,
          })
          .from(zohoInvoices)
          .where(eq(zohoInvoices.invoiceNumber, salesOrder.invoiceNumber))
      : [];

    const pickOrderIds = [
      ...salesOrders.map((so) => so.id),
      ...(pco ? [pco.id] : []),
    ];
    const [pickList] = pickOrderIds.length
      ? await db
          .select({
            id: wmsPickLists.id,
            number: wmsPickLists.pickListNumber,
            status: wmsPickLists.status,
            completedAt: wmsPickLists.completedAt,
          })
          .from(wmsPickLists)
          .where(inArray(wmsPickLists.orderId, pickOrderIds))
          .orderBy(desc(wmsPickLists.createdAt))
          .limit(1)
      : [];

    const [dispatch] = salesOrder?.dispatchBatchId
      ? await db
          .select({
            id: wmsDispatchBatches.id,
            number: wmsDispatchBatches.batchNumber,
            status: wmsDispatchBatches.status,
            dispatchedAt: wmsDispatchBatches.dispatchedAt,
          })
          .from(wmsDispatchBatches)
          .where(eq(wmsDispatchBatches.id, salesOrder.dispatchBatchId))
      : [];

    const steps: OrderChainStep[] = [
      {
        key: 'release',
        label: 'Release',
        reference: release?.requestNumber ?? null,
        status: release?.status ?? null,
        at: release?.at ?? null,
        href: release ? '/platform/admin/cellar-releases' : null,
        done: !!release,
      },
      {
        key: 'pco',
        label: 'Order (PCO)',
        reference: pco?.orderNumber ?? null,
        status: pco?.status ?? null,
        at: pco?.createdAt ?? null,
        href: pco ? `/platform/admin/private-orders/${pco.id}` : null,
        done: !!pco,
      },
      {
        key: 'salesOrder',
        label: 'Zoho sales order',
        reference: salesOrders.map((so) => so.number).join(', ') || null,
        status: salesOrder?.status ?? null,
        at: salesOrder?.orderDate ?? null,
        href: salesOrder ? '/platform/admin/zoho-sales-orders' : null,
        done: !!salesOrder,
      },
      {
        key: 'invoice',
        label: 'Invoice',
        reference: invoice?.number ?? salesOrder?.invoiceNumber ?? null,
        status: invoice
          ? invoice.balance && invoice.balance > 0
            ? 'unpaid'
            : 'paid'
          : null,
        at: invoice?.date ?? null,
        href: null,
        done: !!(invoice ?? salesOrder?.invoiceNumber),
      },
      {
        key: 'pick',
        label: 'Pick list',
        reference: pickList?.number ?? null,
        status: pickList?.status ?? null,
        at: pickList?.completedAt ?? null,
        href: pickList ? `/platform/admin/wms/pick/${pickList.id}` : null,
        done: pickList?.status === 'completed',
      },
      {
        key: 'dispatch',
        label: 'Dispatch',
        reference: dispatch?.number ?? null,
        status: dispatch?.status ?? null,
        at: dispatch?.dispatchedAt ?? null,
        href: dispatch ? `/platform/admin/wms/dispatch/${dispatch.id}` : null,
        done: dispatch?.status === 'dispatched' || dispatch?.status === 'delivered',
      },
      {
        key: 'delivered',
        label: 'Delivered',
        reference: null,
        status: pco?.status === 'delivered' ? 'delivered' : null,
        at: pco?.deliveredAt ?? null,
        href: null,
        done: pco?.status === 'delivered',
      },
    ];

    // A delivery for a member starts at the release; a client sale has none
    const isDelivery = !!release || pco?.orderKind === 'owner_delivery';

    return {
      pcoId: pco?.id ?? null,
      memberName: release?.memberName ?? null,
      customerName: salesOrder?.customerName ?? null,
      steps: isDelivery ? steps : steps.filter((step) => step.key !== 'release'),
    };
  });

export default adminGetOrderChain;
