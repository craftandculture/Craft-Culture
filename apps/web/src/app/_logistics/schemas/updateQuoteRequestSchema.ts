import { z } from 'zod';

/**
 * Schema for updating a quote request
 */
const updateQuoteRequestSchema = z.object({
  // Request ID
  requestId: z.string().uuid(),

  // Status (limited updates)
  status: z.enum(['pending', 'in_progress', 'quoted', 'completed', 'cancelled']).optional(),

  // Priority
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),

  // Route details
  originCountry: z.string().min(1).optional(),
  originCity: z.string().optional().nullable(),
  originWarehouse: z.string().optional().nullable(),
  destinationCountry: z.string().min(1).optional(),
  destinationCity: z.string().optional().nullable(),
  destinationWarehouse: z.string().optional().nullable(),
  transportMode: z.enum(['sea_fcl', 'sea_lcl', 'air', 'road']).optional().nullable(),

  // Cargo details
  productType: z.enum(['wine', 'spirits', 'beer', 'mixed', 'other']).optional(),
  productDescription: z.string().optional().nullable(),
  totalCases: z.number().int().positive().optional().nullable(),
  totalPallets: z.number().int().positive().optional().nullable(),
  totalWeightKg: z.number().positive().optional().nullable(),
  totalVolumeM3: z.number().positive().optional().nullable(),

  // Special requirements
  requiresThermalLiner: z.boolean().optional(),
  requiresTracker: z.boolean().optional(),
  requiresInsurance: z.boolean().optional(),
  temperatureControlled: z.boolean().optional(),
  minTemperature: z.number().optional().nullable(),
  maxTemperature: z.number().optional().nullable(),

  // Timing
  targetPickupDate: z.coerce.date().optional().nullable(),
  targetDeliveryDate: z.coerce.date().optional().nullable(),
  isFlexibleDates: z.boolean().optional(),

  // Notes
  notes: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),

  // Cancellation
  cancellationReason: z.string().optional(),
});

export default updateQuoteRequestSchema;
