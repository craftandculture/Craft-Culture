import { z } from 'zod';

const confirmSupplierOrderItemSchema = z.object({
  itemId: z.string().uuid(),
  confirmationStatus: z.enum(['confirmed', 'updated', 'rejected']),
  updatedPriceUsd: z.number().min(0).optional(),
  updatedQuantity: z.number().min(0).optional(),
  updateReason: z.string().optional(),
  rejectionReason: z.string().optional(),
});

const confirmSupplierOrderSchema = z.object({
  supplierOrderId: z.string().uuid(),
  items: z.array(confirmSupplierOrderItemSchema),
  partnerNotes: z.string().optional(),
});

export default confirmSupplierOrderSchema;
