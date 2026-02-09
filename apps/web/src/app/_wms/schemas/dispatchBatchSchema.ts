import { z } from 'zod';

/**
 * Schema for creating a dispatch batch
 */
export const createDispatchBatchSchema = z.object({
  distributorId: z.string().uuid(),
});

/**
 * Schema for getting dispatch batches
 */
export const getDispatchBatchesSchema = z.object({
  status: z.enum(['draft', 'picking', 'staged', 'dispatched', 'delivered']).optional(),
  distributorId: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

/**
 * Schema for getting a single dispatch batch
 */
export const getDispatchBatchSchema = z.object({
  batchId: z.string().uuid(),
});

/**
 * Schema for adding orders to a batch
 */
export const addOrdersToBatchSchema = z.object({
  batchId: z.string().uuid(),
  orderIds: z.array(z.string().uuid()).min(1),
});

/**
 * Schema for updating batch status
 */
export const updateBatchStatusSchema = z.object({
  batchId: z.string().uuid(),
  status: z.enum(['draft', 'picking', 'staged', 'dispatched', 'delivered']),
  notes: z.string().optional(),
});

/**
 * Schema for generating delivery note
 */
export const generateDeliveryNoteSchema = z.object({
  batchId: z.string().uuid(),
  orderIds: z.array(z.string().uuid()).optional(), // If not provided, includes all orders without DN
  notes: z.string().optional(),
});
