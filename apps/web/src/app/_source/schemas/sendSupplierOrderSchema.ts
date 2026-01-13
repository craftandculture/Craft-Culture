import { z } from 'zod';

const sendSupplierOrderSchema = z.object({
  supplierOrderId: z.string().uuid(),
  sendEmail: z.boolean().default(true),
});

export default sendSupplierOrderSchema;
