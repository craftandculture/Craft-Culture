import { z } from 'zod';

/**
 * Schema for a single item being received
 */
export const receiveItemSchema = z.object({
  shipmentItemId: z.string().uuid(),
  expectedCases: z.number().int().min(0),
  receivedCases: z.number().int().min(0),
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
