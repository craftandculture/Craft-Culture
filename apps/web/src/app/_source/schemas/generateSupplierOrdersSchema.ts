import { z } from 'zod';

const generateSupplierOrdersSchema = z.object({
  customerPoId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).optional(),
});

export default generateSupplierOrdersSchema;
