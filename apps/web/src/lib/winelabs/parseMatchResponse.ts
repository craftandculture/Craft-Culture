/**
 * Read a /match_to_lwin response
 *
 * Wine Labs answers an unmatched query with every field null, so no LWIN7
 * means no match.
 *
 * @example
 *   parseMatchResponse({ lwin7: '1012781', lwin: '10127812015', display_name: 'Opus One', wl_id: 'x' });
 *   // { lwin7: '1012781', lwin: '10127812015', displayName: 'Opus One', wlId: 'x' }
 *
 * @param body - The parsed JSON body
 * @returns The match, or null when there is none
 */
const parseMatchResponse = (body: unknown) => {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const text = (value: unknown) =>
    value === null || value === undefined || value === '' ? null : String(value);

  const lwin = text(record.lwin);
  const lwin7 = text(record.lwin7) ?? (lwin && /^\d{7}/.test(lwin) ? lwin.slice(0, 7) : null);
  if (!lwin7) return null;

  return {
    lwin7,
    lwin,
    displayName: text(record.display_name),
    wlId: text(record.wl_id),
  };
};

export default parseMatchResponse;
