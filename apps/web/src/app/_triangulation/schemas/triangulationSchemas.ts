import { z } from 'zod';

export const triImportKindSchema = z.enum([
  'cc_opening',
  'cc_sales_to_cd',
  'cc_count',
  'cd_sales',
  'cd_count',
]);

export type TriImportKind = z.infer<typeof triImportKindSchema>;

export const triAliasSourceSchema = z.enum([
  'city_drinks',
  'zoho',
  'crurated',
  'packing_list',
  'other',
]);

export type TriAliasSource = z.infer<typeof triAliasSourceSchema>;

/** Date-only string, e.g. 2026-07-31 */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: 'Expected a YYYY-MM-DD date',
});

export const createPeriodSchema = z.object({
  label: z.string().min(1).max(40),
  periodStart: isoDateSchema,
  periodEnd: isoDateSchema,
  notes: z.string().max(2000).optional(),
});

export const updatePeriodStatusSchema = z.object({
  periodId: z.string().uuid(),
  status: z.enum(['open', 'locked']),
});

export const importLineInputSchema = z.object({
  rawCode: z.string().max(200).optional().nullable(),
  rawDescription: z.string().max(500).optional().nullable(),
  rawVintage: z.string().max(20).optional().nullable(),
  quantity: z.number().finite(),
  unit: z.enum(['bottle', 'case']),
  caseConfig: z.number().int().positive().max(120).optional().nullable(),
  unitPrice: z.number().finite().optional().nullable(),
  currency: z.string().max(10).optional().nullable(),
  docRef: z.string().max(120).optional().nullable(),
  docDate: isoDateSchema.optional().nullable(),
  raw: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type ImportLineInput = z.infer<typeof importLineInputSchema>;

export const createImportSchema = z.object({
  periodId: z.string().uuid().optional().nullable(),
  kind: triImportKindSchema,
  fileName: z.string().max(300).optional().nullable(),
  sourceRef: z.string().max(300).optional().nullable(),
  asOfDate: isoDateSchema,
  notes: z.string().max(2000).optional().nullable(),
  /** Which party's codes the `rawCode` column holds, used for alias matching */
  aliasSource: triAliasSourceSchema.default('city_drinks'),
  lines: z.array(importLineInputSchema).min(1).max(20000),
});

export const importIdSchema = z.object({ importId: z.string().uuid() });

/**
 * Corrections to an import already uploaded.
 *
 * Every field is optional — only what is supplied changes. `unit` and
 * `caseConfigOverride` rewrite the lines themselves, which is the common
 * repair: a file uploaded as bottles when it was really cases.
 */
export const updateImportSchema = z.object({
  importId: z.string().uuid(),
  kind: triImportKindSchema.optional(),
  periodId: z.string().uuid().nullable().optional(),
  asOfDate: isoDateSchema.optional(),
  aliasSource: triAliasSourceSchema.optional(),
  notes: z.string().max(2000).nullable().optional(),
  /** Reinterpret every line's quantity as bottles or as cases */
  unit: z.enum(['bottle', 'case']).optional(),
  /** Force a pack size onto every line; null clears it back to the SKU default */
  caseConfigOverride: z.number().int().positive().max(120).nullable().optional(),
});

export const upsertSkuSchema = z.object({
  skuId: z.string().uuid().optional(),
  wCode: z.string().min(1).max(80),
  lwin18: z.string().max(30).optional().nullable(),
  productName: z.string().min(1).max(300),
  producer: z.string().max(200).optional().nullable(),
  vintage: z.number().int().min(1800).max(2100).optional().nullable(),
  bottleSize: z.string().max(30).optional().nullable(),
  caseConfig: z.number().int().positive().max(120).default(6),
  notes: z.string().max(2000).optional().nullable(),
});

export const mapAliasSchema = z.object({
  skuId: z.string().uuid(),
  source: triAliasSourceSchema,
  aliasCode: z.string().min(1).max(200),
  aliasName: z.string().max(500).optional().nullable(),
  /** Re-run mapping over existing draft import lines that carry this code */
  applyToExistingLines: z.boolean().default(true),
});

export const deleteAliasSchema = z.object({ aliasId: z.string().uuid() });

export const getTriangulationSchema = z.object({
  periodId: z.string().uuid().optional().nullable(),
  search: z.string().max(200).optional(),
  /** Show only rows with a count variance or an impossible negative position */
  variancesOnly: z.boolean().default(false),
});

export const getUnmappedSchema = z.object({
  importId: z.string().uuid().optional().nullable(),
  limit: z.number().int().positive().max(500).default(200),
});

export const skuLedgerSchema = z.object({
  skuId: z.string().uuid(),
  periodId: z.string().uuid().optional().nullable(),
});

export const seedSkusFromWmsSchema = z.object({
  ownerName: z.string().min(1).max(200).default('Crurated'),
});

export const syncCountFromWmsSchema = z.object({
  ownerName: z.string().min(1).max(200).default('Crurated'),
  periodId: z.string().uuid().nullable().optional(),
  /** Snapshot date; defaults to today on the server when omitted */
  asOfDate: isoDateSchema.optional(),
});
