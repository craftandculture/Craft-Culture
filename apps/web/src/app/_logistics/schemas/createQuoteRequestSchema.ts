import { z } from 'zod';

/**
 * Schema for creating a new quote request
 */
const createQuoteRequestSchema = z.object({
  // Priority
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),

  // Route details
  originCountry: z.string().min(1, 'Origin country is required'),
  originCity: z.string().optional(),
  originWarehouse: z.string().optional(),
  destinationCountry: z.string().min(1, 'Destination country is required'),
  destinationCity: z.string().optional(),
  destinationWarehouse: z.string().optional(),
  transportMode: z.enum(['sea_fcl', 'sea_lcl', 'air', 'road']).optional(),

  // Cargo details
  productType: z.enum(['wine', 'spirits', 'beer', 'mixed', 'other']).default('wine'),
  productDescription: z.string().optional(),
  totalCases: z.number().int().positive().optional(),
  totalPallets: z.number().int().positive().optional(),
  totalWeightKg: z.number().positive().optional(),
  totalVolumeM3: z.number().positive().optional(),

  // Special requirements
  requiresThermalLiner: z.boolean().default(false),
  requiresTracker: z.boolean().default(false),
  requiresInsurance: z.boolean().default(false),
  temperatureControlled: z.boolean().default(false),
  minTemperature: z.number().optional(),
  maxTemperature: z.number().optional(),

  // Timing
  targetPickupDate: z.coerce.date().optional(),
  targetDeliveryDate: z.coerce.date().optional(),
  isFlexibleDates: z.boolean().default(true),

  // Notes
  notes: z.string().optional(),
});

export default createQuoteRequestSchema;
