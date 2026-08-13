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

export const commitImportSchema = z.object({
  importId: z.string().uuid(),
  /**
   * Commit even though lines look like stock already counted. Requires the
   * warning to have been seen, so a double-counted shipment is a decision
   * rather than an accident.
   */
  acknowledgeDuplicates: z.boolean().default(false),
});

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

/** Repoint a code at a different SKU, whether or not it is already mapped */
export const moveCodeToSkuSchema = z.object({
  normalizedCode: z.string().min(1).max(200),
  skuId: z.string().uuid(),
});

/** Accept one of the warehouse's LWINs for a SKU that has none */
export const setSkuLwinSchema = z.object({
  skuId: z.string().uuid(),
  lwin18: z.string().min(1).max(50),
});

export const autoMapSchema = z.object({
  /** Report what would be mapped without writing anything */
  dryRun: z.boolean().default(false),
});

export const mergeSkusSchema = z.object({
  /** The duplicate, which is removed */
  fromSkuId: z.string().uuid(),
  /** The SKU that keeps the wine's aliases, lines and history */
  intoSkuId: z.string().uuid(),
});

export const setCodeIgnoredSchema = z.object({
  normalizedCode: z.string().min(1),
  /** True to exclude the code as not this reconciliation's stock */
  ignore: z.boolean(),
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
  /** Show codes already set aside as not this reconciliation's stock */
  includeIgnored: z.boolean().default(false),
  /** Narrow the queue by product name or code */
  search: z.string().max(200).optional(),
  limit: z.number().int().positive().max(500).default(200),
});

export const skuLedgerSchema = z.object({
  skuId: z.string().uuid(),
  periodId: z.string().uuid().optional().nullable(),
});

export const seedSkusFromWmsSchema = z.object({
  ownerName: z.string().min(1).max(200).default('Crurated'),
});

export const extractPackingListSchema = z.object({
  /** Base64-encoded document, without a data: prefix */
  file: z.string().min(1),
  mediaType: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
  fileName: z.string().max(300).optional(),
});

export const syncSalesFromZohoSchema = z.object({
  /**
   * Matched against the Zoho customer name word by word, ignoring spacing and
   * punctuation. City Drinks trade as "C D General Trading L.L.C".
   */
  customerMatch: z.string().min(2).max(200).default('CD General'),
  periodId: z.string().uuid().nullable().optional(),
  asOfDate: isoDateSchema.optional(),
});

export const syncCountFromWmsSchema = z.object({
  ownerName: z.string().min(1).max(200).default('Crurated'),
  periodId: z.string().uuid().nullable().optional(),
  /** Snapshot date; defaults to today on the server when omitted */
  asOfDate: isoDateSchema.optional(),
});
