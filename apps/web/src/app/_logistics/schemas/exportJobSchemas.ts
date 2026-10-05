import { z } from 'zod';

import { EXPORT_MODE_KEYS, EXPORT_STAGE_KEYS } from '../utils/exportStages';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date');
const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).nullable().optional();

/** Create an export job. Client, origin, destination and mode are required. */
export const createExportJobSchema = z.object({
  clientName: text(200).min(1, 'Enter the client'),
  zohoCustomerId: optionalText(60),
  originCity: text(120).min(1, 'Enter the origin'),
  originCountry: optionalText(120),
  destinationCity: text(120).min(1, 'Enter the destination'),
  destinationCountry: optionalText(120),
  mode: z.enum(EXPORT_MODE_KEYS),
  carrierName: optionalText(120),
  invoiceNumber: optionalText(80),
  invoiceValue: z.number().min(0).nullable().optional(),
  invoiceCurrency: text(3).min(3).default('AED'),
  exportInvoiceId: z.string().uuid().nullable().optional(),
  notes: optionalText(2000),
});

/** Edit an export job's details; anything left out is unchanged */
export const updateExportJobSchema = z.object({
  shipmentId: z.string().uuid(),
  clientName: text(200).min(1, 'Enter the client').optional(),
  zohoCustomerId: optionalText(60),
  originCity: text(120).min(1, 'Enter the origin').optional(),
  originCountry: optionalText(120),
  destinationCity: text(120).min(1, 'Enter the destination').optional(),
  destinationCountry: optionalText(120),
  mode: z.enum(EXPORT_MODE_KEYS).optional(),
  stage: z.enum(EXPORT_STAGE_KEYS).optional(),
  carrierName: optionalText(120),
  awbNumber: optionalText(80),
  blNumber: optionalText(80),
  invoiceNumber: optionalText(80),
  invoiceValue: z.number().min(0).nullable().optional(),
  invoiceCurrency: text(3).min(3).optional(),
  exportInvoiceId: z.string().uuid().nullable().optional(),
  notes: optionalText(2000),
});

/** Record the movement bond's figures or steps; anything left out is unchanged */
export const saveBondSchema = z.object({
  shipmentId: z.string().uuid(),
  goodsValue: z.number().min(0).nullable().optional(),
  bondAmount: z.number().min(0).nullable().optional(),
  currency: text(3).min(3).optional(),
  declarationNumber: optionalText(80),
  paidOn: isoDate.nullable().optional(),
  arrivedOn: isoDate.nullable().optional(),
  stampedOn: isoDate.nullable().optional(),
  claimSubmittedOn: isoDate.nullable().optional(),
  refundedOn: isoDate.nullable().optional(),
  refundAmount: z.number().min(0).nullable().optional(),
});

/** Attach a file already uploaded to Blob to an export job */
export const addExportDocumentSchema = z.object({
  shipmentId: z.string().uuid(),
  blobUrl: z.string().url(),
  filename: text(300).min(1),
  mimeType: text(120),
  fileSize: z.number().int().min(0).optional(),
  /** invoice → commercial invoice; stamped → customs paperwork that redeems the bond */
  kind: z.enum(['invoice', 'stamped', 'awb', 'bl', 'other']),
});

export type CreateExportJobInput = z.infer<typeof createExportJobSchema>;
export type UpdateExportJobInput = z.infer<typeof updateExportJobSchema>;
export type SaveBondInput = z.infer<typeof saveBondSchema>;
