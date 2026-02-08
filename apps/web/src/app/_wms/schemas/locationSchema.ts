import { z } from 'zod';

/**
 * Storage method for location (pallet vs shelf picking)
 */
export const storageMethodEnum = z.enum(['pallet', 'shelf', 'mixed']);

/**
 * Schema for creating a new WMS location
 */
export const createLocationSchema = z.object({
  aisle: z.string().min(1).max(10),
  bay: z.string().min(1).max(10),
  level: z.string().min(1).max(10),
  position: z.string().max(5).optional(), // Sub-position (L, R, 01, 02, A, B, C)
  locationType: z.enum(['rack', 'floor', 'receiving', 'shipping']),
  storageMethod: storageMethodEnum.default('shelf'),
  capacityCases: z.number().int().positive().optional(),
  requiresForklift: z.boolean().default(false),
  notes: z.string().optional(),
});

/**
 * Schema for updating an existing WMS location
 */
export const updateLocationSchema = z.object({
  id: z.string().uuid(),
  storageMethod: storageMethodEnum.optional(),
  position: z.string().max(5).optional().nullable(),
  capacityCases: z.number().int().positive().optional().nullable(),
  requiresForklift: z.boolean().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

/**
 * Schema for querying locations
 */
export const getLocationsSchema = z.object({
  aisle: z.string().optional(),
  locationType: z.enum(['rack', 'floor', 'receiving', 'shipping']).optional(),
  storageMethod: storageMethodEnum.optional(),
  isActive: z.boolean().optional(),
  search: z.string().optional(),
});

/**
 * Schema for batch creating locations
 */
export const batchCreateLocationsSchema = z.object({
  aisles: z.array(z.string().min(1).max(10)).min(1),
  bays: z.array(z.string().min(1).max(10)).min(1),
  levels: z.array(z.string().min(1).max(10)).min(1),
  positions: z.array(z.string().max(5)).optional(), // Optional positions per level (L, R, A, B, C)
  locationType: z.enum(['rack', 'floor', 'receiving', 'shipping']).default('rack'),
  storageMethod: storageMethodEnum.default('shelf'),
  forkliftFromLevel: z.string().optional(),
});

export default createLocationSchema;
