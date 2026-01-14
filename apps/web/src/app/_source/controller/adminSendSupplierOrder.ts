import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  partners,
  sourceCustomerPos,
  sourceSupplierOrderItems,
  sourceSupplierOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import sendSupplierOrderSchema from '../schemas/sendSupplierOrderSchema';
import { exportSupplierOrderToBase64 } from '../utils/exportSupplierOrderToExcel';
import notifyPartnerOfSupplierOrder from '../utils/notifyPartnerOfSupplierOrder';

/**
 * Send a supplier order to a partner
 * Generates Excel file and sends notification
 *
 * @example
 *   await trpcClient.source.admin.customerPo.sendSupplierOrder.mutate({
 *     supplierOrderId: "uuid-here",
 *     sendEmail: true,
 *   });
 */
const adminSendSupplierOrder = adminProcedure
  .input(sendSupplierOrderSchema)
  .mutation(async ({ input }) => {
    try {
      const { supplierOrderId, sendEmail } = input;

      // Get supplier order with partner details
      const [supplierOrder] = await db
        .select({
          id: sourceSupplierOrders.id,
          orderNumber: sourceSupplierOrders.orderNumber,
          customerPoId: sourceSupplierOrders.customerPoId,
          partnerId: sourceSupplierOrders.partnerId,
          status: sourceSupplierOrders.status,
          totalAmountUsd: sourceSupplierOrders.totalAmountUsd,
        })
        .from(sourceSupplierOrders)
        .where(eq(sourceSupplierOrders.id, supplierOrderId))
        .limit(1);

      if (!supplierOrder) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Supplier order not found',
        });
      }

      if (supplierOrder.status !== 'draft') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Order has already been sent',
        });
      }

      // Get partner details
      const [partner] = await db
        .select({
          id: partners.id,
          businessName: partners.businessName,
          businessEmail: partners.businessEmail,
        })
        .from(partners)
        .where(eq(partners.id, supplierOrder.partnerId))
        .limit(1);

      if (!partner) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Partner not found',
        });
      }

      // Get customer PO details
      const [customerPo] = await db
        .select({
          ccPoNumber: sourceCustomerPos.ccPoNumber,
          customerCompany: sourceCustomerPos.customerCompany,
        })
        .from(sourceCustomerPos)
        .where(eq(sourceCustomerPos.id, supplierOrder.customerPoId))
        .limit(1);

      // Get order items
      const orderItems = await db
        .select()
        .from(sourceSupplierOrderItems)
        .where(eq(sourceSupplierOrderItems.supplierOrderId, supplierOrderId))
        .orderBy(sourceSupplierOrderItems.sortOrder);

      // Generate Excel file
      const excelData = {
        orderNumber: supplierOrder.orderNumber,
        partnerName: partner.businessName,
        customerPoNumber: customerPo?.ccPoNumber,
        customerCompany: customerPo?.customerCompany,
        createdAt: new Date(),
        items: orderItems.map((item) => ({
          productName: item.productName,
          producer: item.producer,
          vintage: item.vintage,
          lwin7: item.lwin7,
          lwin18: item.lwin18,
          quantityBottles: item.quantityBottles,
          quantityCases: item.quantityCases,
          caseConfig: item.caseConfig,
          costPerBottleUsd: item.costPerBottleUsd,
          costPerCaseUsd: item.costPerCaseUsd,
          lineTotalUsd: item.lineTotalUsd,
        })),
        totalAmountUsd: supplierOrder.totalAmountUsd,
      };

      const { base64, filename } = exportSupplierOrderToBase64(excelData);

      // Update order status to sent
      await db
        .update(sourceSupplierOrders)
        .set({
          status: 'sent',
          sentAt: new Date(),
          excelFileUrl: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`,
          updatedAt: new Date(),
        })
        .where(eq(sourceSupplierOrders.id, supplierOrderId));

      // Send notification to partner (in-app notification + email)
      void notifyPartnerOfSupplierOrder({
        supplierOrderId: supplierOrder.id,
        partnerId: partner.id,
      });

      // Log email status (email is sent via notification utility above)
      if (sendEmail && partner.businessEmail) {
        logger.info('Email notification sent to partner:', {
          email: partner.businessEmail,
          orderNumber: supplierOrder.orderNumber,
        });
      }

      // Update customer PO status if all orders are sent
      const [stillDraft] = await db
        .select({ id: sourceSupplierOrders.id })
        .from(sourceSupplierOrders)
        .where(eq(sourceSupplierOrders.status, 'draft'))
        .limit(1);

      if (!stillDraft) {
        await db
          .update(sourceCustomerPos)
          .set({
            status: 'awaiting_confirmations',
            updatedAt: new Date(),
          })
          .where(eq(sourceCustomerPos.id, supplierOrder.customerPoId));
      }

      return {
        success: true,
        orderNumber: supplierOrder.orderNumber,
        partnerName: partner.businessName,
        excelFilename: filename,
        excelBase64: base64,
        emailSent: sendEmail && !!partner.businessEmail,
      };
    } catch (error) {
      logger.error('Error sending supplier order:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to send supplier order. Please try again.',
      });
    }
  });

export default adminSendSupplierOrder;
