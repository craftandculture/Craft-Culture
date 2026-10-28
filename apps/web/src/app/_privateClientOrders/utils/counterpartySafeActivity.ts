import { partnerSafeActivity } from './staffOnlyActivity';

interface ActivityLogFields {
  metadata: unknown;
  partnerId: string | null;
  action: string;
  notes: string | null;
}

interface ActivityRow<T extends ActivityLogFields> {
  log: T;
  user: { id: string; name: string; email: string } | null;
  partner: { id: string; businessName: string } | null;
}

/** Metadata keys that name the business on the other side of the order */
const COUNTERPARTY_METADATA_KEYS = ['distributorName', 'partnerName'];

/**
 * An activity log entry as one side of an order may see it
 *
 * A wine partner and the distributor on the same order are never shown each
 * other's staff: no names, no emails. The other side appears under a role
 * label, so "Distributor" or "Trade partner" rather than the business, which
 * keeps a partner from going round C&C to the distributor and the other way
 * about. C&C's own entries, and the viewer's own team, read as they are,
 * without email addresses.
 *
 * @example
 *   counterpartySafeActivity(row, order.distributorId, 'Distributor');
 *
 * @param row - The log row with its user and partner joins
 * @param otherSideId - The partner id of the other side of the order
 * @param otherSideLabel - What to call the other side
 * @returns The row without margin figures, emails or the other side's names
 */
const counterpartySafeActivity = <T extends ActivityLogFields>(
  row: ActivityRow<T>,
  otherSideId: string | null,
  otherSideLabel: string,
) => {
  const log = partnerSafeActivity(row.log);
  const isOtherSide = !!otherSideId && row.log.partnerId === otherSideId;

  const metadata =
    log.metadata && typeof log.metadata === 'object'
      ? { ...(log.metadata as Record<string, unknown>) }
      : log.metadata;
  if (metadata && typeof metadata === 'object') {
    for (const key of COUNTERPARTY_METADATA_KEYS) {
      delete (metadata as Record<string, unknown>)[key];
    }
  }

  return {
    ...log,
    metadata,
    // The default assignment note reads "Assigned to <distributor>"
    notes: log.action === 'distributor_assigned' ? 'Assigned to a licensed distributor' : log.notes,
    user: isOtherSide || !row.user ? null : { id: row.user.id, name: row.user.name },
    partner: isOtherSide
      ? { id: '', businessName: otherSideLabel }
      : row.partner,
  };
};

export default counterpartySafeActivity;
