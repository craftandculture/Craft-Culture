/**
 * Should this scheduled run list every invoiced order, not just recent ones?
 *
 * The five-minute sync lists only invoiced orders Zoho modified in the last
 * 30 days. Once an hour (the run that lands in the first five minutes of the
 * hour, UTC) it lists them all, as every run used to, so anything a
 * time-bounded listing cannot see — an order invoiced without its
 * last-modified time moving, or an old invoiced order voided in Zoho — is
 * still picked up within the hour. The Sync Orders button always lists all.
 *
 * @example
 *   isFullSweepSlot(new Date('2026-11-11T09:02:00Z')); // true
 *   isFullSweepSlot(new Date('2026-11-11T09:07:00Z')); // false
 *
 * @param now - The time of the run
 * @returns True for the hourly full sweep
 */
const isFullSweepSlot = (now: Date) => now.getUTCMinutes() < 5;

export default isFullSweepSlot;
