import { z } from 'zod';

/**
 * Schema for adding a new bay (creates all levels for that bay)
 */
export const addBaySchema = z.object({
  aisle: z.string().min(1).max(10),
  bay: z.string().min(1).max(10),
  levels: z.array(z.string().min(1).max(10)).min(1),
  forkliftFromLevel: z.string().optional(),
});

/**
 * Schema for deleting a bay (removes all locations for that bay)
 */
export const deleteBaySchema = z.object({
  aisle: z.string().min(1).max(10),
  bay: z.string().min(1).max(10),
});

/**
 * Schema for updating bay levels (add or remove levels from an existing bay)
 */
export const updateBayLevelsSchema = z.object({
  aisle: z.string().min(1).max(10),
  bay: z.string().min(1).max(10),
  levels: z.array(z.string().min(1).max(10)).min(1),
  forkliftFromLevel: z.string().optional(),
});

export type AddBayInput = z.infer<typeof addBaySchema>;
export type DeleteBayInput = z.infer<typeof deleteBaySchema>;
export type UpdateBayLevelsInput = z.infer<typeof updateBayLevelsSchema>;
