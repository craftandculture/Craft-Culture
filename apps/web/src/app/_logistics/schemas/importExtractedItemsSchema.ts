import { z } from 'zod';

/**
 * Schema for an extracted line item to import
 */
const extractedItemSchema = z.object({
  description: z.string().optional(),
  productName: z.string().optional(),
  lwin: z.string().optional(),
  supplierSku: z.string().optional(), // Supplier's own reference code (e.g., W-codes from CRURATED)
  producer: z.string().optional(),
  vintage: z.number().optional(),
  bottleSize: z.string().optional(),
  bottlesPerCase: z.number().optional(),
  alcoholPercent: z.number().optional(),
  region: z.string().optional(),
  hsCode: z.string().optional(),
  quantity: z.number().optional(),
  cases: z.number().optional(),
  /** Bottle count, where the document counts bottles rather than cases */
  bottles: z.number().optional(),
  /** Litres per bottle, and printed litres for the line — the line's own check */
  productSizeL: z.number().optional(),
  totalSizeL: z.number().optional(),
  weight: z.number().optional(),
  volume: z.number().optional(),
  unitPrice: z.number().optional(),
  unitPriceBasis: z.enum(['bottle', 'case']).optional(),
  total: z.number().optional(),
  countryOfOrigin: z.string().optional(),
});

/**
 * Schema for cargo summary data (from packing lists, BOLs)
 */
const cargoSummarySchema = z.object({
  totalCases: z.number().optional(),
  totalPallets: z.number().optional(),
  totalWeight: z.number().optional(), // kg
  totalVolume: z.number().optional(), // m³
});

/**
 * What the document's own totals row and shipping note declare.
 *
 * Stored beside our figures rather than instead of them: cases are what was
 * billed, cartons are what physically travelled, and on a mixed shipment they
 * differ for good reason.
 */
const declaredTotalsSchema = z.object({
  cases: z.number().nullable().optional(),
  bottles: z.number().nullable().optional(),
  cartons: z.number().nullable().optional(),
  pallets: z.number().nullable().optional(),
  value: z.number().nullable().optional(),
  source: z.string().nullable().optional(),
});

/**
 * Schema for importing extracted items to a shipment
 */
const importExtractedItemsSchema = z.object({
  shipmentId: z.string().uuid(),
  /**
   * The currency the document is written in — required, never assumed.
   *
   * Carried so prices can be stored as billed and converted once, at a rate
   * someone chose, rather than arriving pre-converted at a rate nobody saw.
   *
   * It was optional and defaulted to USD, which is how a pound invoice was
   * imported as dollars: nothing on a Wilkinson sheet names a currency, the
   * model guessed, and because the shipment then looked American the FX
   * prompt never appeared. An import that cannot say what it is billed in has
   * to stop and ask.
   */
  currency: z.string().length(3, 'State the currency the document is billed in'),
  items: z.array(extractedItemSchema).min(1, 'At least one item is required'),
  // Optional cargo summary data to update on shipment
  cargoSummary: cargoSummarySchema.optional(),
  /** The document's own totals, for someone to reconcile ours against */
  declared: declaredTotalsSchema.optional(),
  // Whether to update shipment cargo fields (even if they have values)
  overwriteCargoData: z.boolean().optional().default(false),
});

export type ImportExtractedItemsInput = z.infer<typeof importExtractedItemsSchema>;
export type ExtractedItem = z.infer<typeof extractedItemSchema>;
export type CargoSummary = z.infer<typeof cargoSummarySchema>;
export type DeclaredTotalsInput = z.infer<typeof declaredTotalsSchema>;

export default importExtractedItemsSchema;
