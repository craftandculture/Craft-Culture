import { z } from 'zod';

/** A party on the document: exporter, consignee or collection point */
export const exportPartySchema = z.object({
  name: z.string(),
  addressLines: z.array(z.string()),
  trn: z.string().nullable(),
  /** What the id in `trn` is, when it is not a UAE TRN — a UK import's exporter shows its EORI */
  idLabel: z.string().optional(),
});

/** One Zoho invoice the document draws on */
export const exportSourceRefSchema = z.object({
  zohoInvoiceId: z.string(),
  invoiceNumber: z.string(),
  soNumber: z.string().nullable(),
  pcoNumber: z.string().nullable(),
  invoiceDate: z.string(),
  /** What the invoice bills, after any discount — the figure the total must meet */
  totalUsd: z.number(),
});

/** A BOE the stock could have come from, offered when it is not certain */
export const exportBoeCandidateSchema = z.object({
  boe: z.string(),
  ownerName: z.string().nullable(),
  quantityCases: z.number(),
});

/** A group of lines under one heading: one invoice, or identical PCO orders */
export const exportSectionSchema = z.object({
  id: z.string(),
  refs: z.array(
    z.object({
      invoiceNumber: z.string(),
      soNumber: z.string().nullable(),
      pcoNumber: z.string().nullable(),
    }),
  ),
  note: z.string().nullable(),
});

/**
 * One line of the export invoice
 *
 * A `cased` line is a pack of one wine. A `mixedCase` line is a carton of a
 * PCO order holding several wines, which is how PCOs are physically packed —
 * so `qty` is always cartons and the column adds up to the case count.
 */
export const exportLineSchema = z.object({
  id: z.string(),
  sectionId: z.string(),
  kind: z.enum(['cased', 'mixedCase']),
  description: z.string(),
  hsCode: z.string(),
  origin: z.string(),
  packBottles: z.number().int().positive(),
  bottleSizeCl: z.number().positive(),
  qty: z.number().int().nonnegative(),
  unitPrice: z.number(),
  amount: z.number(),
  /** The wines in a mixed case; empty on a cased line */
  components: z.array(
    z.object({
      description: z.string(),
      /** Customs want origin per item, never "Italy / France" for a case */
      origin: z.string(),
      hsCode: z.string().optional(),
      unitPrice: z.number(),
      lwin18: z.string().nullable(),
    }),
  ),
  boe: z.string().nullable(),
  boeCandidates: z.array(exportBoeCandidateSchema),
  /** Whose stock the BOE was found under, for the owner check */
  boeOwnerName: z.string().nullable(),
  source: z.object({
    invoiceNumbers: z.array(z.string()),
    zohoLineItemIds: z.array(z.string()),
    /** The invoiced amount behind this line, net of discount, in USD */
    netUsd: z.number(),
    lwin18: z.string().nullable(),
    /** The order's owner, when known, for the BOE owner check */
    ownerName: z.string().nullable(),
  }),
  extra: z.record(z.string(), z.string()),
  /** Set when a price or quantity departs from the Zoho invoice */
  override: z
    .object({
      reason: z.string(),
      originalUnitPrice: z.number(),
      originalQty: z.number(),
    })
    .nullable(),
});

export const exportHeaderSchema = z.object({
  /** Null until issued, so a discarded draft does not burn a number */
  number: z.string().nullable(),
  date: z.string(),
  exporter: exportPartySchema,
  consignee: exportPartySchema,
  collection: exportPartySchema,
  terms: z.string(),
  currency: z.enum(['AED', 'USD']),
  /** Units of the document currency per USD */
  rate: z.number().positive(),
  pallets: z.number().int().nullable(),
  grossWeightKg: z.number().nullable(),
  grossWeightEstimated: z.boolean(),
  /** Set only when customs want a case count other than the Qty column's */
  casesOverride: z.number().int().nullable(),
  /**
   * `ukImport`: C&C's own UK EORI ships wine out of a UK bond (LCB, BBR…) to
   * C&C FZE. Its lines are read from the supplier's documents, not from Zoho,
   * so there are no Zoho sources and no BOEs. Absent on every export document.
   */
  kind: z.enum(['export', 'ukImport']).optional(),
  /** Further facts customs want, printed as a strip: EORI, duty status, ports, AWB */
  exportDetails: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  /** The supplier documents a UK import was read from */
  referenceDocs: z.array(z.string()).optional(),
  /** What those documents say they total, in the document currency, to check the lines against */
  statedTotal: z.number().nullable().optional(),
  /** The company stamp printed in the signature box */
  stamp: z.enum(['ukEori']).nullable().optional(),
});

/**
 * An export invoice, as data
 *
 * The on-screen preview and the PDF are both drawn from this, and every
 * change — typed directly, asked of Claude or replayed from a consignee's
 * standing rules — is an edit op applied to it. The BOE table and the totals
 * are derived, never stored, so they cannot disagree with the lines.
 */
export const exportDocumentSchema = z.object({
  header: exportHeaderSchema,
  sources: z.array(exportSourceRefSchema),
  sections: z.array(exportSectionSchema),
  lines: z.array(exportLineSchema),
  extraColumns: z.array(z.object({ key: z.string(), label: z.string() })),
  notes: z.array(z.string()),
  declaration: z.string(),
});

/** A UK import: shipped by C&C's UK EORI from a UK bond to C&C FZE */
export const isUkImport = (doc: { header: { kind?: string } }) => doc.header.kind === 'ukImport';

export type ExportParty = z.infer<typeof exportPartySchema>;
export type ExportSourceRef = z.infer<typeof exportSourceRefSchema>;
export type ExportBoeCandidate = z.infer<typeof exportBoeCandidateSchema>;
export type ExportSection = z.infer<typeof exportSectionSchema>;
export type ExportLine = z.infer<typeof exportLineSchema>;
export type ExportHeader = z.infer<typeof exportHeaderSchema>;
export type ExportDocument = z.infer<typeof exportDocumentSchema>;
