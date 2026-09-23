import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';

/**
 * Whether a code can stand as a wine's LWIN18 — and so as its Zoho SKU
 *
 * The catalogue carries codes that look like LWINs and are not: rows from the
 * local inventory sheet are keyed `"1010000000000000000:row28"`, the LWIN in
 * front having been rounded to three significant figures by a spreadsheet that
 * held it as a number. A partner picking that wine carried the key onto their
 * order, and the sales order minted six Zoho items under it.
 *
 * Accepts the dashed shape (compact 18 digits is normalised first) with a
 * non-zero pack and bottle size. The first segment may be alphanumeric, since
 * spirits were given supplier-code pseudo-LWINs before the 9xxxxxx internal
 * range existed. A rounded LWIN fails on the pack or size, which come out 00.
 *
 * @example
 *   isUsableLwin18('1012781-2014-06-00750'); // true
 *   isUsableLwin18('101278120140600750'); // true
 *   isUsableLwin18('1010000000000000000:row28'); // false
 *   isUsableLwin18('101000000000000000'); // false — pack 00
 *
 * @param value - The code to check
 * @returns True when it is a LWIN18 a line can be sold under
 */
const isUsableLwin18 = (value: string | null | undefined) => {
  if (!value) return false;

  const match = /^([A-Za-z0-9]+)-(\d{4})-(\d{2})-(\d{5})$/.exec(
    normalizeLwin18(value.trim()),
  );

  if (!match) return false;

  return Number(match[3]) > 0 && Number(match[4]) > 0;
};

export default isUsableLwin18;
