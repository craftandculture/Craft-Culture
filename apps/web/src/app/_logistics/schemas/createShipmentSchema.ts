import { z } from 'zod';

/**
 * Schema for creating a new logistics shipment
 */
const createShipmentSchema = z.object({
  // Required fields
  type: z.enum(['inbound', 'outbound', 're_export']),
  transportMode: z.enum(['sea_fcl', 'sea_lcl', 'air', 'road']),

  // Partner (for inbound) or client contact (for outbound)
  partnerId: z.string().uuid().optional(),
  clientContactId: z.string().uuid().optional(),

  // Origin
  originCountry: z.string().min(1).optional(),
  originCity: z.string().min(1).optional(),
  originWarehouse: z.string().optional(),

  // Destination
  destinationCountry: z.string().min(1).optional(),
  destinationCity: z.string().min(1).optional(),
  destinationWarehouse: z.string().default('RAK Port'),

  // Carrier info
  carrierName: z.string().optional(),
  carrierBookingRef: z.string().optional(),
  containerNumber: z.string().optional(),
  blNumber: z.string().optional(),
  awbNumber: z.string().optional(),

  // Timeline
  etd: z.coerce.date().optional(),
  eta: z.coerce.date().optional(),

  // Notes
  internalNotes: z.string().optional(),
  partnerNotes: z.string().optional(),
});

export default createShipmentSchema;
