import { z } from 'zod';

/**
 * Schema for creating a new private client order
 */
const createOrderSchema = z.object({
  // Client info (can be linked or inline)
  clientId: z.string().uuid().optional(),
  clientName: z.string().min(1, 'Client name is required'),
  clientEmail: z.string().email().optional().or(z.literal('')),
  clientPhone: z.string().optional(),
  clientAddress: z.string().optional(),
  deliveryNotes: z.string().optional(),
  partnerNotes: z.string().optional(),
});

export default createOrderSchema;
