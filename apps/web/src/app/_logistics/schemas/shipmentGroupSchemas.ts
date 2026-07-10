import { z } from 'zod';

/** Cost fields shared by a consolidation group (all optional, USD). */
const groupCostFields = {
  freightCostUsd: z.number().min(0).nullable().optional(),
  insuranceCostUsd: z.number().min(0).nullable().optional(),
  originHandlingUsd: z.number().min(0).nullable().optional(),
  destinationHandlingUsd: z.number().min(0).nullable().optional(),
  customsClearanceUsd: z.number().min(0).nullable().optional(),
  govFeesUsd: z.number().min(0).nullable().optional(),
  deliveryCostUsd: z.number().min(0).nullable().optional(),
  otherCostsUsd: z.number().min(0).nullable().optional(),
  costAllocationMethod: z.enum(['by_bottle', 'by_weight', 'by_value']).optional(),
};

/** Create a consolidation group and optionally assign shipments to it. */
export const createShipmentGroupSchema = z.object({
  name: z.string().min(1).max(200),
  reference: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  shipmentIds: z.array(z.string().uuid()).default([]),
});

/** Update a group's details, costs, and/or membership. */
export const updateShipmentGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  reference: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  /** When provided, replaces the group's shipment membership entirely. */
  shipmentIds: z.array(z.string().uuid()).optional(),
  ...groupCostFields,
});

/** Read a single group with its shipments and items. */
export const getShipmentGroupSchema = z.object({
  id: z.string().uuid(),
});

/** Allocate the group's costs across every bottle and write landed cost. */
export const calculateShipmentGroupSchema = z.object({
  id: z.string().uuid(),
});

/** Delete a group (shipments are unassigned, not deleted). */
export const deleteShipmentGroupSchema = z.object({
  id: z.string().uuid(),
});
