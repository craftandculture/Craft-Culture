import { z } from 'zod';

/**
 * Schema for a single location assignment when receiving an item
 */
const locationAssignmentSchema = z.object({
  locationId: z.string().uuid(),
  cases: z.number().int().min(1),
  isPalletized: z.boolean().optional(),
});

/**
 * Schema for receiving a single item from a shipment incrementally
 *
 * Used for per-product receiving where each product is committed to the
 * backend as soon as it's verified and labels are printed, rather than
 * waiting for the entire shipment to be processed.
 *
 * @example
 *   await trpcClient.wms.admin.receiving.receiveShipmentItem.mutate({
 *     shipmentId: 'uuid',
 *     lotNumber: '2026-02-14-001',
 *     item: {
 *       shipmentItemId: 'uuid',
 *       receivedCases: 15,
 *       locationAssignments: [
 *         { locationId: 'uuid', cases: 5 },
 *         { locationId: 'uuid', cases: 10 },
 *       ],
 *     },
 *   });
 */
const receiveSingleItemSchema = z.object({
  shipmentId: z.string().uuid(),
  lotNumber: z.string().min(1),
  notes: z.string().optional(),
  item: z.object({
    shipmentItemId: z.string().uuid(),
    expectedCases: z.number().int().min(0),
    receivedCases: z.number().int().min(1),
    receivedBottlesPerCase: z.number().int().min(1).optional(),
    receivedBottleSizeMl: z.number().int().min(1).optional(),
    packChanged: z.boolean().optional(),
    isAddedItem: z.boolean().optional(),
    productName: z.string().optional(),
    producer: z.string().nullable().optional(),
    vintage: z.number().nullable().optional(),
    lwin: z.string().nullable().optional(),
    supplierSku: z.string().nullable().optional(),
    hsCode: z.string().nullable().optional(),
    countryOfOrigin: z.string().nullable().optional(),
    expiryDate: z.date().optional(),
    notes: z.string().optional(),
    locationAssignments: z.array(locationAssignmentSchema).min(1),
  }),
});

export type ReceiveSingleItem = z.infer<typeof receiveSingleItemSchema>;

export default receiveSingleItemSchema;
