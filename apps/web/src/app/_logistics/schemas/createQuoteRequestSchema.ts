import { z } from 'zod';

/** Schema for creating a new quote request */
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
  productType: z
    .enum(['wine', 'spirits', 'beer', 'mixed', 'other'])
    .default('wine'),
  productDescription: z.string().optional(),
  totalCases: z.number().int().positive().optional(),
  totalPallets: z.number().int().positive().optional(),
  totalWeightKg: z.number().positive().optional(),
  totalVolumeM3: z.number().positive().optional(),
  totalBottles: z.number().int().positive().optional(),
  total75clEquivalents: z.number().positive().optional(),

  // Where the request was started from
  sourceType: z.enum(['shipment', 'uk_move']).optional(),
  sourceId: z.string().uuid().optional(),
  /** The kind of job the request opens; read from the route when omitted */
  jobType: z
    .enum(['inbound', 'outbound', 're_export', 'mainland_transfer'])
    .optional(),

  /** The date forwarders are asked to reply by */
  replyBy: z.coerce.date().optional(),
  /** Forwarders to ask, added to the request as it is saved */
  forwarderIds: z.array(z.string().uuid()).max(20).optional(),
  /** Forwarders typed in on the form, added to the list as the request is saved */
  newForwarders: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        email: z.string().trim().email().optional().or(z.literal('')),
      }),
    )
    .max(10)
    .optional(),
  /** Email the request to its forwarders from logistics@ as soon as it is saved */
  sendNow: z.boolean().optional(),

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
