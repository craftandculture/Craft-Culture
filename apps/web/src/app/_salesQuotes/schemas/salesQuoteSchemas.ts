import { z } from 'zod';

/** A single line on a sales quote. Prices are per BOTTLE, In Bond USD. */
export const salesQuoteLineSchema = z.object({
  lwin18: z.string().default(''),
  wine: z.string().min(1),
  vintage: z.string().min(1),
  /** bottle volume in cl */
  size: z.number().int().positive().default(75),
  /** bottles per case */
  pack: z.number().int().positive().default(6),
  /** available BOTTLES */
  avail: z.number().int().min(0).default(0),
  /** pre-filled quantity in bottles; 0 leaves the line open for the client */
  qty: z.number().int().min(0).default(0),
  busd: z.number().min(0),
  baed: z.number().min(0).optional(),
  cusd: z.number().min(0).optional(),
  caed: z.number().min(0).optional(),
  region: z.string().default('Other'),
  promo: z.boolean().optional(),
  pc: z.boolean().optional(),
  loc: z.string().optional(),
  note: z.string().optional(),
  oos: z.boolean().optional(),
});

/** Template toggles for a quote. */
export const salesQuoteOptionsSchema = z.object({
  bottlesOnly: z.boolean().optional(),
  offered: z.boolean().optional(),
  orderUnit: z.enum(['bottle', 'case']).optional(),
  stockStatus: z.boolean().optional(),
  pcLabel: z.string().optional(),
  whLabel: z.string().optional(),
  ibLabel: z.string().optional(),
  regionOrder: z.array(z.string()).optional(),
  priceBasis: z.string().optional(),
  leadNote: z.string().optional(),
  title: z.string().optional(),
  /** trailing derived price column, e.g. { label: 'TBS UAE', multiplier: 1.18 } */
  extraCol: z
    .object({ label: z.string().min(1), multiplier: z.number().positive() })
    .optional(),
});

/**
 * Slugs land in a public URL, so keep them lowercase, hyphenated and free of
 * anything that would need escaping.
 */
export const slugSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers and single hyphens',
  );

/** Create or update a quote. Omit `id` to create. */
export const saveSalesQuoteSchema = z.object({
  id: z.string().uuid().optional(),
  slug: slugSchema,
  quoteRef: z.string().min(1),
  client: z.string().min(1),
  clientCompany: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  eyebrow: z.string().default('Indicative Quotation'),
  h1: z.string().default('Fine Wine Quotation'),
  subtitle: z.string().optional(),
  /** date-only strings, e.g. "2026-08-26" */
  validUntil: z.string().optional(),
  promoUntil: z.string().optional(),
  lines: z.array(salesQuoteLineSchema),
  options: salesQuoteOptionsSchema.default({}),
});

export const salesQuoteIdSchema = z.object({ id: z.string().uuid() });

export const setSalesQuoteStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['draft', 'published', 'archived']),
});

export const listSalesQuotesSchema = z.object({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  client: z.string().optional(),
  search: z.string().optional(),
});

/** Filters for the line picker, mirroring the catalogue feed's own filters. */
export const selectableLinesSchema = z.object({
  search: z.string().optional(),
  category: z.enum(['Wine', 'Spirits', 'RTD']).optional(),
  ownerId: z.string().uuid().optional(),
  /** held stock in the UAE warehouse, or in-transit shipments */
  stock: z.enum(['held', 'inbound']).default('held'),
});

export type SaveSalesQuoteInput = z.infer<typeof saveSalesQuoteSchema>;
