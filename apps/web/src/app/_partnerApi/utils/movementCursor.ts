const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres `timestamp::text`, e.g. `2026-11-24 09:15:02.123456` */
const PG_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?$/;

/**
 * Encode and decode the opaque cursor the movements export pages with
 *
 * Movements are read oldest first by (performed_at, id), so a cursor is the
 * last row's pair. The time is Postgres's own text form, to the microsecond:
 * a JavaScript Date keeps only milliseconds, and a cursor rounded down would
 * hand the boundary row back on the next page. Base64url keeps it opaque, so
 * integrators store and send it back rather than building one.
 *
 * @example
 *   const next = movementCursor.encode('2026-11-24 09:15:02.123456', 'uuid');
 *   movementCursor.decode(next); // { at: '2026-11-24 09:15:02.123456', id: 'uuid' }
 *   movementCursor.decode('junk'); // null
 */
const movementCursor = {
  encode: (at: string, id: string) =>
    Buffer.from(`${at}|${id}`, 'utf8').toString('base64url'),

  decode: (cursor: string) => {
    const [at, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');

    if (!at || !PG_TIMESTAMP.test(at) || !id || !UUID.test(id)) return null;
    return { at, id };
  },
};

export default movementCursor;
