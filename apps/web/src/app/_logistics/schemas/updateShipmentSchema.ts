import { z } from 'zod';

/**
 * Schema for updating a logistics shipment
 */
const updateShipmentSchema = z.object({
  id: z.string().uuid(),

  // Optional updates
  type: z.enum(['inbound', 'outbound', 're_export']).optional(),
  transportMode: z.enum(['sea_fcl', 'sea_lcl', 'air', 'road']).optional(),

  // Partner (for inbound) or client contact (for outbound)
  partnerId: z.string().uuid().nullable().optional(),
  clientContactId: z.string().uuid().nullable().optional(),

  // Origin
  originCountry: z.string().optional(),
  originCity: z.string().optional(),
  originWarehouse: z.string().optional(),

  // Destination
  destinationCountry: z.string().optional(),
  destinationCity: z.string().optional(),
  destinationWarehouse: z.string().optional(),

  // Carrier info
  carrierName: z.string().optional(),
  carrierBookingRef: z.string().optional(),
  containerNumber: z.string().optional(),
  blNumber: z.string().optional(),
  awbNumber: z.string().optional(),

  // Timeline
  etd: z.coerce.date().nullable().optional(),
  atd: z.coerce.date().nullable().optional(),
  eta: z.coerce.date().nullable().optional(),
  ata: z.coerce.date().nullable().optional(),
  deliveredAt: z.coerce.date().nullable().optional(),

  // Cargo details
  totalCases: z.number().int().min(0).optional(),
  totalBottles: z.number().int().min(0).optional(),
  totalWeightKg: z.number().min(0).optional(),
  totalVolumeM3: z.number().min(0).optional(),

  // Cost tracking
  freightCostUsd: z.number().min(0).optional(),
  insuranceCostUsd: z.number().min(0).optional(),
  originHandlingUsd: z.number().min(0).optional(),
  destinationHandlingUsd: z.number().min(0).optional(),
  customsClearanceUsd: z.number().min(0).optional(),
  govFeesUsd: z.number().min(0).optional(),
  deliveryCostUsd: z.number().min(0).optional(),
  otherCostsUsd: z.number().min(0).optional(),

  // Cost allocation method
  costAllocationMethod: z.enum(['by_bottle', 'by_weight', 'by_value']).optional(),

  // Notes
  internalNotes: z.string().optional(),
  partnerNotes: z.string().optional(),
});

export default updateShipmentSchema;
