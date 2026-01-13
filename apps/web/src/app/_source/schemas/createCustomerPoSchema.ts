import { z } from 'zod';

const createCustomerPoSchema = z.object({
  poNumber: z.string().min(1, 'Customer PO number is required'),
  rfqId: z.string().uuid().optional(),
  customerName: z.string().min(1, 'Customer name is required'),
  customerCompany: z.string().optional(),
  customerEmail: z
    .string()
    .transform((val) => (val === '' ? undefined : val))
    .pipe(z.string().email().optional()),
  notes: z.string().optional(),
});

export default createCustomerPoSchema;
