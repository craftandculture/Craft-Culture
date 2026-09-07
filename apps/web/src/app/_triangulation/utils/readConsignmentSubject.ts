/**
 * The owners a consignment invoice can name, as the subject line spells them.
 *
 * `MIX` is not an owner. It says the invoice carries several owners' wine, and
 * that each line has to be attributed from its own SKU instead.
 */
export const OWNER_BY_TAG: Record<string, string> = {
  CC: 'C&C',
  CRURATED: 'Crurated',
  RARE: 'Rare',
  CRU: 'Cru',
  CULT: 'Cult',
};

/**
 * Payment terms that mark a consignment, as Zoho labels them.
 *
 * The terms are a second, independent signal: an invoice can be consignment
 * stock without anyone having typed the subject line correctly.
 */
const CONSIGNMENT_TERMS = /consignment|90\s*days/i;

export interface ConsignmentSubject {
  /** Whether this invoice belongs in the reconciliation at all */
  isConsignment: boolean;
  /**
   * Whose wine it is, when the subject says so.
   *
   * Null on a `CONSIGNMENT_MIX` — and on an invoice recognised only by its
   * payment terms — which means the owner must come from each line's SKU.
   */
  ownerName: string | null;
  /** True when every line has to be attributed individually */
  isMixed: boolean;
  /** What the decision was made on, so a wrong call can be traced */
  reason: string;
}

/**
 * Decide whether a Zoho invoice is consignment stock, and whose
 *
 * Only invoices the business has marked as consignment belong in this
 * reconciliation. Every invoice to City Drinks was being read, so ordinary
 * sales — wine they had bought outright — were counted as consigned and then
 * chased as unbilled.
 *
 * The subject line is the primary signal, and the tag after `CONSIGNMENT_` is
 * matched **exactly** rather than by prefix: `CRU` is the start of `CRURATED`,
 * so a prefix match would quietly file every Crurated invoice under Cru Wine
 * and settle the wrong owner.
 *
 * @example
 *   readConsignmentSubject('CONSIGNMENT_CRURATED', null).ownerName; // 'Crurated'
 *   readConsignmentSubject('CONSIGNMENT_CRU', null).ownerName; // 'Cru'
 *   readConsignmentSubject('CONSIGNMENT_MIX', null).isMixed; // true
 *
 * @param subject - The invoice's subject line
 * @param paymentTerms - Zoho's payment-terms label, e.g. "90 days"
 * @returns What the invoice is, and whose
 */
const readConsignmentSubject = (
  subject: string | null | undefined,
  paymentTerms: string | null | undefined,
): ConsignmentSubject => {
  const flat = (subject ?? '').toUpperCase().replace(/[^A-Z_]/g, '');
  const tagged = /CONSIGNMENT_([A-Z]+)/.exec(flat);

  if (tagged) {
    const tag = tagged[1] ?? '';

    if (tag === 'MIX') {
      return {
        isConsignment: true,
        ownerName: null,
        isMixed: true,
        reason: 'Subject CONSIGNMENT_MIX — owner taken per line',
      };
    }

    const ownerName = OWNER_BY_TAG[tag];

    if (ownerName) {
      return {
        isConsignment: true,
        ownerName,
        isMixed: false,
        reason: `Subject CONSIGNMENT_${tag}`,
      };
    }

    /*
      Tagged as a consignment but with an owner nobody recognises. Kept, and
      attributed per line — dropping it would silently shrink the month, which
      is the one failure that would not be noticed.
    */
    return {
      isConsignment: true,
      ownerName: null,
      isMixed: true,
      reason: `Subject CONSIGNMENT_${tag} — unrecognised owner, owner taken per line`,
    };
  }

  if (CONSIGNMENT_TERMS.test(paymentTerms ?? '')) {
    return {
      isConsignment: true,
      ownerName: null,
      isMixed: true,
      reason: `Payment terms "${paymentTerms}" — no subject tag, owner taken per line`,
    };
  }

  return {
    isConsignment: false,
    ownerName: null,
    isMixed: false,
    reason: subject
      ? `Subject "${subject}" is not a consignment tag`
      : 'No consignment subject or payment terms',
  };
};

export default readConsignmentSubject;
