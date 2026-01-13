import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { sourceSupplierOrders } from '@/database/schema';
import { partnerProcedure } from '@/lib/trpc/procedures';

/**
 * Download a Supplier Order Excel file
 *
 * @example
 *   await trpcClient.source.partner.supplierOrders.downloadExcel.query({
 *     id: "uuid-here",
 *   });
 */
const partnerDownloadSupplierOrderExcel = partnerProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input, ctx: { user } }) => {
    const { id } = input;

    // Get supplier order - ensure it belongs to this partner
    const [supplierOrder] = await db
      .select({
        id: sourceSupplierOrders.id,
        orderNumber: sourceSupplierOrders.orderNumber,
        excelFileUrl: sourceSupplierOrders.excelFileUrl,
      })
      .from(sourceSupplierOrders)
      .where(
        and(
          eq(sourceSupplierOrders.id, id),
          eq(sourceSupplierOrders.partnerId, user.partnerId),
        ),
      )
      .limit(1);

    if (!supplierOrder) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Supplier order not found',
      });
    }

    if (!supplierOrder.excelFileUrl) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Excel file not available for this order',
      });
    }

    // Extract base64 from data URL
    const base64Match = supplierOrder.excelFileUrl.match(
      /^data:application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet;base64,(.+)$/,
    );

    if (!base64Match?.[1]) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Invalid Excel file format',
      });
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `SupplierOrder_${supplierOrder.orderNumber}_${timestamp}.xlsx`;

    return {
      base64: base64Match[1],
      filename,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  });

export default partnerDownloadSupplierOrderExcel;
