import { z } from 'zod';

/**
 * Schema for transferring stock ownership between partners
 */
export const transferOwnershipSchema = z.object({
  /** Stock record ID to transfer */
  stockId: z.string().uuid(),
  /** New owner partner ID */
  newOwnerId: z.string().uuid(),
  /** Quantity to transfer (partial transfers supported) */
  quantityCases: z.number().int().positive(),
  /** New sales arrangement for the transferred stock */
  salesArrangement: z.enum(['consignment', 'purchased']).optional(),
  /** Commission percentage (for consignment) */
  consignmentCommissionPercent: z.number().min(0).max(100).optional(),
  /** Notes for the transfer */
  notes: z.string().optional(),
});

/**
 * Schema for reserving stock for an order
 */
export const reserveStockSchema = z.object({
  /** Stock record ID */
  stockId: z.string().uuid(),
  /** Quantity to reserve */
  quantityCases: z.number().int().positive(),
  /** Order ID this reservation is for */
  orderId: z.string().uuid(),
  /** Order number for reference */
  orderNumber: z.string(),
});

/**
 * Schema for releasing a stock reservation
 */
export const releaseReservationSchema = z.object({
  /** Stock record ID */
  stockId: z.string().uuid(),
  /** Quantity to release */
  quantityCases: z.number().int().positive(),
  /** Order ID the reservation was for */
  orderId: z.string().uuid().optional(),
  /** Reason for release */
  reason: z.string().optional(),
});

/**
 * Schema for resolving partner requests
 */
export const resolvePartnerRequestSchema = z.object({
  /** Request ID */
  requestId: z.string().uuid(),
  /** Resolution status */
  status: z.enum(['approved', 'rejected']),
  /** Admin notes */
  adminNotes: z.string().optional(),
});

/**
 * Schema for querying partner requests
 */
export const getPartnerRequestsSchema = z.object({
  /** Filter by status */
  status: z.enum(['pending', 'approved', 'rejected', 'completed']).optional(),
  /** Filter by partner */
  partnerId: z.string().uuid().optional(),
  /** Filter by request type */
  requestType: z.enum(['transfer', 'mark_for_sale', 'withdrawal']).optional(),
  /** Pagination */
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});
