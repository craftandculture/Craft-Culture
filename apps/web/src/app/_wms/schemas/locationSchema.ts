import { z } from 'zod';

/**
 * Schema for creating a new WMS location
 */
export const createLocationSchema = z.object({
  aisle: z.string().min(1).max(10),
  bay: z.string().min(1).max(10),
  level: z.string().min(1).max(10),
  locationType: z.enum(['rack', 'floor', 'receiving', 'shipping']),
  capacityCases: z.number().int().positive().optional(),
  requiresForklift: z.boolean().default(false),
  notes: z.string().optional(),
});

/**
 * Schema for updating an existing WMS location
 */
export const updateLocationSchema = z.object({
  id: z.string().uuid(),
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
  locationType: z.enum(['rack', 'floor', 'receiving', 'shipping']).default('rack'),
  forkliftFromLevel: z.string().optional(),
});

export default createLocationSchema;
