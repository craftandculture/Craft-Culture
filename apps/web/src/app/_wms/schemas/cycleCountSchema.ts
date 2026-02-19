import { z } from 'zod';

export const createCycleCountSchema = z.object({
  locationId: z.string().uuid('Invalid location ID'),
  notes: z.string().optional(),
});

export const getCycleCountsSchema = z.object({
  status: z
    .enum(['pending', 'in_progress', 'completed', 'reconciled'])
    .optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export const getCycleCountSchema = z.object({
  countId: z.string().uuid('Invalid count ID'),
});

export const startCycleCountSchema = z.object({
  countId: z.string().uuid('Invalid count ID'),
});

export const recordCycleCountItemSchema = z.object({
  cycleCountId: z.string().uuid('Invalid count ID'),
  itemId: z.string().uuid('Invalid item ID'),
  countedQuantity: z.number().int().min(0, 'Quantity cannot be negative'),
  notes: z.string().optional(),
});

export const completeCycleCountSchema = z.object({
  countId: z.string().uuid('Invalid count ID'),
});

export const reconcileCycleCountSchema = z.object({
  countId: z.string().uuid('Invalid count ID'),
  adjustments: z.array(
    z.object({
      itemId: z.string().uuid('Invalid item ID'),
      approved: z.boolean(),
    }),
  ),
});
