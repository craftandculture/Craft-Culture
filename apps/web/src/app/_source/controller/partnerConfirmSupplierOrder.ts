import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import {
  sourceCustomerPoItems,
  sourceCustomerPos,
  sourceSupplierOrderItems,
  sourceSupplierOrders,
} from '@/database/schema';
import { partnerProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import confirmSupplierOrderSchema from '../schemas/confirmSupplierOrderSchema';

/**
 * Confirm, update, or reject items in a supplier order
 *
 * @example
 *   await trpcClient.source.partner.supplierOrders.confirm.mutate({
 *     supplierOrderId: "uuid-here",
 *     items: [
 *       { itemId: "item-1", confirmationStatus: "confirmed" },
 *       { itemId: "item-2", confirmationStatus: "updated", updatedPriceUsd: 150 },
 *       { itemId: "item-3", confirmationStatus: "rejected", rejectionReason: "Out of stock" },
 *     ],
 *   });
 */
const partnerConfirmSupplierOrder = partnerProcedure
  .input(confirmSupplierOrderSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    try {
      const { supplierOrderId, items, partnerNotes } = input;

      // Verify order belongs to this partner
      const [supplierOrder] = await db
        .select()
        .from(sourceSupplierOrders)
        .where(
          and(
            eq(sourceSupplierOrders.id, supplierOrderId),
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

      if (!['sent', 'pending_confirmation'].includes(supplierOrder.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Order cannot be confirmed in its current status',
        });
      }

      // Get existing order items
      const itemIds = items.map((i) => i.itemId);
      const existingItems = await db
        .select()
        .from(sourceSupplierOrderItems)
        .where(
          and(
            eq(sourceSupplierOrderItems.supplierOrderId, supplierOrderId),
            inArray(sourceSupplierOrderItems.id, itemIds),
          ),
        );

      if (existingItems.length !== items.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'One or more items not found in this order',
        });
      }

      // Update each item
      let confirmedCount = 0;
      let updatedCount = 0;
      let rejectedCount = 0;
      let confirmedAmountUsd = 0;

      for (const itemUpdate of items) {
        const existingItem = existingItems.find(
          (i) => i.id === itemUpdate.itemId,
        );
        if (!existingItem) continue;

        const updateData: Record<string, unknown> = {
          confirmationStatus: itemUpdate.confirmationStatus,
          confirmedAt: new Date(),
          updatedAt: new Date(),
        };

        if (itemUpdate.confirmationStatus === 'confirmed') {
          confirmedCount++;
          confirmedAmountUsd += existingItem.lineTotalUsd || 0;
        } else if (itemUpdate.confirmationStatus === 'updated') {
          updatedCount++;
          updateData.updatedPriceUsd = itemUpdate.updatedPriceUsd;
          updateData.updatedQuantity = itemUpdate.updatedQuantity;
          updateData.updateReason = itemUpdate.updateReason;

          // Calculate new line total if price was updated
          if (itemUpdate.updatedPriceUsd !== undefined) {
            const qty = itemUpdate.updatedQuantity || existingItem.quantityCases || 1;
            confirmedAmountUsd += itemUpdate.updatedPriceUsd * qty;
          } else {
            confirmedAmountUsd += existingItem.lineTotalUsd || 0;
          }
        } else if (itemUpdate.confirmationStatus === 'rejected') {
          rejectedCount++;
          updateData.rejectionReason = itemUpdate.rejectionReason;
        }

        await db
          .update(sourceSupplierOrderItems)
          .set(updateData)
          .where(eq(sourceSupplierOrderItems.id, itemUpdate.itemId));

        // Update customer PO item status
        if (existingItem.customerPoItemId) {
          const newStatus =
            itemUpdate.confirmationStatus === 'rejected'
              ? 'matched'
              : 'confirmed';
          await db
            .update(sourceCustomerPoItems)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(sourceCustomerPoItems.id, existingItem.customerPoItemId));
        }
      }

      // Determine order status
      let newOrderStatus: 'confirmed' | 'partial' | 'rejected' =
        'confirmed';
      if (rejectedCount === items.length) {
        newOrderStatus = 'rejected';
      } else if (rejectedCount > 0 || updatedCount > 0) {
        newOrderStatus = 'partial';
      }

      // Update supplier order
      await db
        .update(sourceSupplierOrders)
        .set({
          status: newOrderStatus,
          confirmedAmountUsd: Math.round(confirmedAmountUsd * 100) / 100,
          confirmedAt: new Date(),
          partnerNotes: partnerNotes || null,
          updatedAt: new Date(),
        })
        .where(eq(sourceSupplierOrders.id, supplierOrderId));

      // Check if all orders for this customer PO are confirmed
      const allOrdersForPo = await db
        .select({ status: sourceSupplierOrders.status })
        .from(sourceSupplierOrders)
        .where(eq(sourceSupplierOrders.customerPoId, supplierOrder.customerPoId));

      const allConfirmed = allOrdersForPo.every((o) =>
        ['confirmed', 'partial', 'rejected'].includes(o.status),
      );

      if (allConfirmed) {
        await db
          .update(sourceCustomerPos)
          .set({
            status: 'confirmed',
            allConfirmedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(sourceCustomerPos.id, supplierOrder.customerPoId));
      }

      // TODO: Notify admin of partner response
      // await notifyAdminOfOrderResponse({
      //   orderId: supplierOrderId,
      //   partnerId: user.partnerId,
      //   status: newOrderStatus,
      // });

      return {
        success: true,
        orderStatus: newOrderStatus,
        confirmedCount,
        updatedCount,
        rejectedCount,
        confirmedAmountUsd: Math.round(confirmedAmountUsd * 100) / 100,
      };
    } catch (error) {
      logger.error('Error confirming supplier order:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to confirm order. Please try again.',
      });
    }
  });

export default partnerConfirmSupplierOrder;
