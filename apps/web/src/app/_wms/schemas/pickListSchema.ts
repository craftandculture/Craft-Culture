import { z } from 'zod';

/**
 * Schema for creating a pick list from an order
 */
export const createPickListSchema = z.object({
  orderId: z.string().uuid(),
});

/**
 * Schema for getting pick lists
 */
export const getPickListsSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

/**
 * Schema for getting a single pick list
 */
export const getPickListSchema = z.object({
  pickListId: z.string().uuid(),
});

/**
 * Schema for assigning a pick list to a user
 */
export const assignPickListSchema = z.object({
  pickListId: z.string().uuid(),
  assignedTo: z.string().uuid().optional(),
});

/**
 * Schema for picking an item
 */
export const pickItemSchema = z.object({
  pickListItemId: z.string().uuid(),
  pickedFromLocationId: z.string().uuid(),
  pickedQuantity: z.number().int().positive(),
  // Bottle-level pick. When set, this is a split-case pick of exactly this many
  // loose bottles: the system draws from already-open bottles first, then
  // cracks sealed cases as needed (auto-split). Omitted = normal whole-case pick.
  pickedBottles: z.number().int().positive().optional(),
  caseBarcode: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Schema for completing a pick list
 */
export const completePickListSchema = z.object({
  pickListId: z.string().uuid(),
  notes: z.string().optional(),
});
