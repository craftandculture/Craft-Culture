import { z } from 'zod';

/**
 * Schema for supplier payouts list
 */
export const supplierPayoutsListSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  status: z.enum(['pending', 'processing', 'paid']).optional(),
});

/**
 * Schema for admin processing a payout
 */
export const adminPayoutProcessSchema = z.object({
  payoutId: z.string().uuid(),
  transactionReference: z.string().optional(),
  notes: z.string().optional(),
});

export default supplierPayoutsListSchema;
