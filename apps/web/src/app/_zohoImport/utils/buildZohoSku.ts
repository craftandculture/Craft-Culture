import normalizeLwin18 from '@/app/_lwin/utils/normalizeLwin18';

/**
 * The Zoho SKU for an imported line: its LWIN18 in the canonical dashed form
 *
 * `{LWIN7}-{vintage}-{pack}-{size}`, e.g. `1012781-2014-06-00750`. The LWIN7 is
 * the matched Liv-ex code or a C&C internal code (9000001 upwards) for a wine
 * Liv-ex does not list. A line with neither has no SKU, rather than a
 * placeholder such as `0000000…` that would create a junk Zoho item. A missing
 * vintage is written as 1000, the LWIN non-vintage marker.
 *
 * Built from the line's own fields every time, so editing the vintage or pack
 * also changes the SKU.
 *
 * @example
 *   buildZohoSku({
 *     lwin7: '1012781',
 *     vintage: '2014',
 *     caseConfig: 6,
 *     bottleSize: 750,
 *   }); // '1012781-2014-06-00750'
 *   buildZohoSku({
 *     lwin7: null,
 *     vintage: '2014',
 *     caseConfig: 6,
 *     bottleSize: 750,
 *   }); // null
 *
 * @param item - The line's LWIN7, vintage, bottles per case and bottle size in
 *   ml
 * @returns The dashed LWIN18, or null when the line has no valid LWIN7
 */
const buildZohoSku = (item: {
  lwin7: string | null;
  vintage: string | null;
  caseConfig: number;
  bottleSize: number;
}) => {
  const lwin7 = item.lwin7?.trim() ?? '';
  if (!/^\d{1,7}$/.test(lwin7) || /^0+$/.test(lwin7)) return null;

  const vintage = /^\d{4}$/.test(item.vintage?.trim() ?? '')
    ? item.vintage!.trim()
    : '1000';
  const pack = Math.round(item.caseConfig);
  const size = Math.round(item.bottleSize);
  if (!(pack >= 1 && pack <= 99) || !(size >= 1 && size <= 99999)) return null;

  return normalizeLwin18(
    `${lwin7.padStart(7, '0')}${vintage}${String(pack).padStart(2, '0')}${String(size).padStart(5, '0')}`,
  );
};

export default buildZohoSku;
