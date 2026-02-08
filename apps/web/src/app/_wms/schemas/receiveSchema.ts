import { z } from 'zod';

/**
 * Schema for a single item being received
 *
 * Supports both original shipment items and manually added pack variants
 */
export const receiveItemSchema = z.object({
  // For original items: the shipment item ID
  // For added items: the base shipment item ID (what it was derived from)
  shipmentItemId: z.string().uuid(),
  expectedCases: z.number().int().min(0),
  receivedCases: z.number().int().min(0),
  // Pack configuration - allows changing if different pack size arrived
  receivedBottlesPerCase: z.number().int().min(1).optional(),
  receivedBottleSizeMl: z.number().int().min(1).optional(),
  packChanged: z.boolean().optional(),
  // For added items - explicit product info
  isAddedItem: z.boolean().optional(),
  productName: z.string().optional(),
  producer: z.string().nullable().optional(),
  vintage: z.number().nullable().optional(),
  // Product identification
  lwin: z.string().nullable().optional(), // LWIN from lookup or supplier SKU used as identifier
  supplierSku: z.string().nullable().optional(), // Supplier's own reference code (e.g., W-codes from CRURATED)
  // Customs data (for Zoho sync)
  hsCode: z.string().nullable().optional(), // HS/tariff code for customs
  countryOfOrigin: z.string().nullable().optional(), // Country of origin for customs
  // Per-item location for direct-to-rack receiving
  locationId: z.string().uuid().optional(),
  expiryDate: z.date().optional(),
  notes: z.string().optional(),
});

/**
 * Schema for receiving a shipment
 */
export const receiveShipmentSchema = z.object({
  shipmentId: z.string().uuid(),
  items: z.array(receiveItemSchema).min(1),
  receivingLocationId: z.string().uuid(),
  notes: z.string().optional(),
});

export type ReceiveItem = z.infer<typeof receiveItemSchema>;
export type ReceiveShipment = z.infer<typeof receiveShipmentSchema>;
