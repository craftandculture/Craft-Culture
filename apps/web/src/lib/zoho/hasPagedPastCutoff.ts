/**
 * Has a newest-first page of Zoho records reached records older than the cutoff?
 *
 * Used to stop paging a listing requested with
 * `sort_column=last_modified_time&sort_order=D`. It only says yes when the
 * page really is in that order and every time on it parses: should Zoho ever
 * ignore the sort, the caller keeps paging and gets the full listing, as it
 * did before, rather than silently dropping recent records that sit on a
 * later page.
 *
 * @example
 *   hasPagedPastCutoff(
 *     [{ last_modified_time: '2026-11-10T09:00:00+0000' }, { last_modified_time: '2026-09-01T09:00:00+0000' }],
 *     new Date('2026-10-12T00:00:00Z'),
 *   ); // true
 *
 * @param records - One page, as Zoho returned it
 * @param cutoff - Records modified before this are not wanted
 * @returns True when no later page can hold a record modified at or after the cutoff
 */
const hasPagedPastCutoff = (
  records: { last_modified_time?: string }[],
  cutoff: Date,
) => {
  if (records.length === 0) return false;

  const times = records.map((record) =>
    record.last_modified_time ? new Date(record.last_modified_time).getTime() : NaN,
  );

  if (times.some((time) => Number.isNaN(time))) return false;

  for (let index = 1; index < times.length; index++) {
    if (times[index]! > times[index - 1]!) return false;
  }

  return times[times.length - 1]! < cutoff.getTime();
};

export default hasPagedPastCutoff;
