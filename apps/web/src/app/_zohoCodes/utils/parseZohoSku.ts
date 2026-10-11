export interface ParsedZohoSku {
  /** The Stock Explorer form, LLLLLLL-YYYY-PP-SSSSS, when the SKU is an LWIN */
  canonical: string | null;
  form: 'dashed' | 'compact' | 'misdashed' | 'blank' | 'other';
}

const DASHED = /^[A-Z0-9]+-\d{4}-\d{2}-\d{5}$/;

/**
 * Read a Zoho item SKU as the LWIN-18 Stock Explorer uses
 *
 * Zoho holds the same code three ways: dashed (canonical), compact 18 digits
 * (Cult Wines' and older items), and with the dashes in the wrong places
 * ("1014600-2021-0100-750"). Compact 19-digit codes carry a six-digit size
 * ("…06000750") and are read as five. Crurated's alphanumeric wine codes are
 * accepted. Anything else — brand codes, "HK - Sass2020", 17 digits — is
 * 'other' and has no canonical form.
 *
 * @example
 *   parseZohoSku('101539120150600750'); // { canonical: '1015391-2015-06-00750', form: 'compact' }
 *
 * @param raw - The SKU as Zoho holds it
 * @returns The canonical code and which form it was in
 */
const parseZohoSku = (raw: string | null | undefined): ParsedZohoSku => {
  const sku = (raw ?? '').trim().toUpperCase();
  if (!sku) return { canonical: null, form: 'blank' };
  if (DASHED.test(sku)) return { canonical: sku, form: 'dashed' };

  const flat = sku.replace(/[-\s]/g, '');
  const form = sku.includes('-') ? 'misdashed' : 'compact';

  if (/^\d{18}$/.test(flat)) {
    return {
      canonical: `${flat.slice(0, 7)}-${flat.slice(7, 11)}-${flat.slice(11, 13)}-${flat.slice(13)}`,
      form,
    };
  }
  // Size written with six digits: 1006960 2016 06 000750
  if (/^\d{7}(?:19|20|10)\d{2}\d{2}0\d{5}$/.test(flat)) {
    return {
      canonical: `${flat.slice(0, 7)}-${flat.slice(7, 11)}-${flat.slice(11, 13)}-${flat.slice(14)}`,
      form,
    };
  }
  // Crurated-style wine code: letters in the wine part, then vintage, pack, size
  const alpha = /^([A-Z0-9]*[A-Z][A-Z0-9]*)(\d{4})(\d{2})(\d{5})$/.exec(flat);
  if (alpha && alpha[1]!.length >= 6) {
    return { canonical: `${alpha[1]}-${alpha[2]}-${alpha[3]}-${alpha[4]}`, form };
  }

  return { canonical: null, form: 'other' };
};

export default parseZohoSku;
