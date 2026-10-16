import { z } from 'zod';

import { SHIPMENT_STATUS_KEYS } from '../utils/shipmentStatuses';

/** Groups of statuses the shipments list filters and counts by */
export const SHIPMENT_STAGE_GROUPS = {
  active: ['draft', 'booked', 'picked_up', 'in_transit', 'arrived_port', 'customs_clearance', 'cleared', 'at_warehouse', 'partially_received'],
  on_the_way: ['booked', 'picked_up', 'in_transit'],
  port_customs: ['arrived_port', 'customs_clearance', 'cleared'],
  warehouse: ['at_warehouse', 'partially_received'],
  draft: ['draft'],
  done: ['dispatched', 'delivered'],
  cancelled: ['cancelled'],
} as const;

export type ShipmentStageGroup = keyof typeof SHIPMENT_STAGE_GROUPS;

/**
 * Schema for listing shipments with pagination and filters
 */
const getShipmentsSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  cursor: z.number().min(0).default(0),
  search: z.string().optional(),
  status: z.enum(SHIPMENT_STATUS_KEYS).optional(),
  /** A group of statuses, as the list's tiles show them */
  stage: z.enum(Object.keys(SHIPMENT_STAGE_GROUPS) as [ShipmentStageGroup, ...ShipmentStageGroup[]]).optional(),
  type: z.enum(['inbound', 'outbound', 're_export', 'mainland_transfer']).optional(),
  transportMode: z.enum(['sea_fcl', 'sea_lcl', 'air', 'road']).optional(),
  partnerId: z.string().uuid().optional(),
  /** newest = most recently opened first; eta = soonest arrival first, undated last */
  sort: z.enum(['newest', 'eta']).default('newest'),
});

export default getShipmentsSchema;
