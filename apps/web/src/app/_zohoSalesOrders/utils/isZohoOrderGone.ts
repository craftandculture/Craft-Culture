/**
 * Whether a Zoho error means the sales order has been deleted
 *
 * Zoho answers a deleted order with an error, not an empty one. Anything else
 * (a timeout, a refused token, a 500) means we do not know, and not knowing
 * must never release stock or remove a live order.
 *
 * Only the status and Zoho's own code are matched, never bare digits: a
 * timeout message carries the order id (e.g. 3456789000001002345), and a
 * loose match on "1002" or "404" read that outage as a deletion.
 *
 * Shared by draft holds and the release of stock held for closed orders, so
 * the two can never disagree about which orders are gone.
 *
 * @example
 *   isZohoOrderGone(new Error('Zoho API error: 404 - ...')); // true
 *
 * @param error - The error thrown while fetching the order
 * @returns True when Zoho says the order does not exist
 */
const isZohoOrderGone = (error: unknown) =>
  /Zoho API error: 404\b|"code"\s*:\s*1002\b|does not exist/i.test(
    error instanceof Error ? error.message : String(error),
  );

export default isZohoOrderGone;
