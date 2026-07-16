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
  /** Chargeable weight (kg) from the AWB, for the $/kg benchmark. */
  chargeableWeightKg: z.number().min(0).nullable().optional(),
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

export const costLineCategories = [
  'freight',
  'collection',
  'customs',
  'handling',
  'security',
  'documentation',
  'insurance',
  'duty',
  'delivery',
  'other',
] as const;

/** Add one logistics cost line (invoice charge) to a group. */
export const addGroupCostLineSchema = z.object({
  groupId: z.string().uuid(),
  category: z.enum(costLineCategories).default('freight'),
  description: z.string().max(300).nullable().optional(),
  amount: z.number().min(0),
  currency: z.string().min(3).max(3).default('USD'),
  /** FX rate to USD locked in at entry time (amountUsd = amount * fxToUsd). */
  fxToUsd: z.number().min(0).default(1),
  invoiceRef: z.string().max(120).nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  vendor: z.string().max(200).nullable().optional(),
  scope: z.enum(['shared', 'shipment']).default('shared'),
  shipmentId: z.string().uuid().nullable().optional(),
  sourceDocument: z.string().max(300).nullable().optional(),
});

/** Set the supplier/vendor for every cost line under one invoice in a group. */
export const setGroupInvoiceVendorSchema = z.object({
  groupId: z.string().uuid(),
  /** The grouping key: invoiceRef ?? sourceDocument ?? 'Manual entry'. */
  docKey: z.string().min(1).max(300),
  vendor: z.string().max(200).nullable(),
});

/** Update a cost line. */
export const updateGroupCostLineSchema = z.object({
  id: z.string().uuid(),
  category: z.enum(costLineCategories).optional(),
  description: z.string().max(300).nullable().optional(),
  amount: z.number().min(0).optional(),
  currency: z.string().min(3).max(3).optional(),
  fxToUsd: z.number().min(0).optional(),
  invoiceRef: z.string().max(120).nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  scope: z.enum(['shared', 'shipment']).optional(),
  shipmentId: z.string().uuid().nullable().optional(),
});

/** Delete a cost line. */
export const deleteGroupCostLineSchema = z.object({
  id: z.string().uuid(),
});

export const groupDocumentTypes = [
  'airway_bill',
  'bill_of_lading',
  'commercial_invoice',
  'packing_list',
  'shipping_invoice',
  'gac_invoice',
  'customs_declaration',
  'certificate_of_origin',
  'delivery_note',
  'insurance_certificate',
  'other',
] as const;

/** Upload a document once to a group (applies to all its shipments). */
export const uploadGroupDocumentSchema = z.object({
  groupId: z.string().uuid(),
  /** Base64 data URL of the file. */
  file: z.string(),
  filename: z.string().min(1).max(300),
  documentType: z.enum(groupDocumentTypes).default('other'),
  documentNumber: z.string().max(120).nullable().optional(),
});

/** Delete a group document. */
export const deleteGroupDocumentSchema = z.object({
  id: z.string().uuid(),
});

/** Parse an uploaded freight invoice (PDF/image) into candidate cost lines. */
export const parseGroupInvoiceSchema = z.object({
  groupId: z.string().uuid(),
  /** Base64 data URL (or raw base64) of the invoice file. */
  file: z.string(),
  fileType: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']),
});
