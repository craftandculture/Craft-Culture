import { z } from 'zod';

/** One batch is one month of one box; well above a club's box count */
const MAX_CLONES = 60;

const cloneClientSchema = z.object({
  /** A saved client of the order's partner; details are read from the record */
  clientId: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Client name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
});

/**
 * Input for cloning an order for a list of clients
 */
const cloneOrderSchema = z.object({
  orderId: z.string().uuid(),
  clients: z.array(cloneClientSchema).min(1).max(MAX_CLONES),
});

export default cloneOrderSchema;
