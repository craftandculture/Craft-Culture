/**
 * Has Zoho reported nothing new for an order we already hold?
 *
 * The one definition of "unchanged" shared by the scheduled sweep (which
 * decides in memory, from a single preloaded query) and syncExistingSalesOrder
 * (which decides per order). Unchanged means: not forced, the Zoho status is
 * the one we stored, and Zoho's last-modified time equals the one we stored.
 *
 * The status is compared as well as the time because raising an invoice flips
 * an order open -> invoiced without always bumping its last-modified time.
 *
 * @example
 *   isSalesOrderUnchanged({
 *     stored: { zohoStatus: 'open', zohoLastModifiedTime: new Date('2026-11-01T10:00:00Z') },
 *     zohoOrder: { status: 'open', last_modified_time: '2026-11-01T14:00:00+0400' },
 *   }); // true
 *
 * @param stored - What we hold locally (undefined when nothing was found)
 * @param zohoOrder - The summary from Zoho's list endpoint
 * @param force - A forced pass is never unchanged
 * @returns True when the order can be skipped without asking Zoho for detail
 */
const isSalesOrderUnchanged = ({
  stored,
  zohoOrder,
  force = false,
}: {
  stored:
    | { zohoStatus: string | null; zohoLastModifiedTime: Date | null }
    | undefined;
  zohoOrder: { status: string; last_modified_time: string };
  force?: boolean;
}) => {
  if (force) return false;
  if (stored?.zohoStatus !== zohoOrder.status) return false;

  return (
    stored.zohoLastModifiedTime instanceof Date &&
    stored.zohoLastModifiedTime.getTime() ===
      new Date(zohoOrder.last_modified_time).getTime()
  );
};

export default isSalesOrderUnchanged;
