export const INVOICE_TYPES = [
  'consignment',
  'prepaid',
  'outright',
  'pco',
] as const;

export type InvoiceType = (typeof INVOICE_TYPES)[number];

export interface ClassifyInvoiceInput {
  /** The type a person set on the page, which is final */
  setByHand?: string | null;
  /** Whether the subject, reference or payment terms say consignment */
  taggedConsignment: boolean;
  /** Whether the invoice belongs to a private client order */
  isPco: boolean;
}

export interface ClassifiedInvoice {
  type: InvoiceType;
  reason: string;
}

/** Plain words for each type, as the page shows them */
export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  consignment: 'Consignment',
  prepaid: 'Prepaid by outlet',
  outright: 'Outright sale',
  pco: 'Private client order',
};

/**
 * What a sale against this invoice does to the money
 *
 * Only consignment moves money at settlement: City Drinks are billed and the
 * owner is paid. Prepaid and outright stock is already theirs, so a bottle
 * sold from it is neither billed nor paid, and a PCO was never consignment.
 *
 * @param type - The invoice type
 * @returns Whether bottles drawn from it are billed and paid
 */
export const settles = (type: string | null | undefined) =>
  !type || type === 'consignment';

/**
 * Decide what kind of invoice to an outlet this is
 *
 * The order is deliberate. A person's answer beats the document, because it
 * is set to correct the document. A PCO invoice is outside consignment however
 * it was tagged, since tagging one by habit is exactly how a client's order
 * would end up on a partner's statement. Then the consignment tag or terms.
 * Anything else billed to the outlet is an outright sale: their stock.
 *
 * Prepaid is never inferred. Nothing on a Zoho invoice distinguishes stock
 * City Drinks paid for in advance from stock they bought, so it is set by hand
 * — and seeded for INV-000195 to 197, the January Cru stock.
 *
 * @example
 *   classifyInvoice({ taggedConsignment: true, isPco: false }).type;
 *   // 'consignment'
 *
 * @param input - What is known about the invoice
 * @returns The type and why
 */
const classifyInvoice = ({
  setByHand,
  taggedConsignment,
  isPco,
}: ClassifyInvoiceInput): ClassifiedInvoice => {
  const chosen = INVOICE_TYPES.find((type) => type === setByHand);

  if (chosen) return { type: chosen, reason: 'Set by hand' };

  if (isPco) return { type: 'pco', reason: 'Invoice of a private client order' };

  if (taggedConsignment) {
    return { type: 'consignment', reason: 'Tagged consignment' };
  }

  return { type: 'outright', reason: 'No consignment tag or terms' };
};

export default classifyInvoice;
