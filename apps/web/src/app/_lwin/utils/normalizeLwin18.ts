/**
 * Normalize an LWIN to the canonical dashed LWIN18 form.
 *
 * The system's canonical LWIN18 is dashed — `{LWIN7}-{vintage}-{pack}-{size}`
 * (e.g. `1012781-2014-06-00750`). Some suppliers (e.g. Cult Wines) provide the
 * same 18 digits with no separators (`101278120140600750`), which fails to
 * match canonical records and creates duplicate stock lines. This converts a
 * raw 18-digit LWIN to the dashed form; already-dashed, alphanumeric (spirit
 * pseudo-LWINs) or otherwise non-matching values are returned unchanged.
 *
 * @example
 *   normalizeLwin18('101278120140600750'); // '1012781-2014-06-00750'
 *   normalizeLwin18('1012781-2014-06-00750'); // unchanged
 *
 * @param lwin - The LWIN string to normalize (raw or dashed)
 * @returns The canonical dashed LWIN18, or the trimmed input if not a raw
 *   18-digit code, or null when given null/undefined
 */
const normalizeLwin18 = (lwin: string | null | undefined): string | null => {
  if (lwin == null) return null;

  const trimmed = lwin.trim();
  // Compact 18-digit form (LWIN7 + vintage4 + pack2 + size5) → dashed canonical
  const compact = trimmed.match(/^(\d{7})(\d{4})(\d{2})(\d{5})$/);
  if (!compact) return trimmed;

  const [, lwin7, vintage, caseSize, bottleSize] = compact;
  return `${lwin7}-${vintage}-${caseSize}-${bottleSize}`;
};

export default normalizeLwin18;
