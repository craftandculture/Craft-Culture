/**
 * Timeline entries only C&C sees
 *
 * Internal notes, and every change to the order's margins: the C&C and
 * distributor percentages are ours, and a partner or distributor who read them
 * off the timeline could work out what the other side earns.
 */
export const STAFF_ONLY_ACTIVITY_ACTIONS = [
  'internal_note_added',
  'pricing_updated',
] as const;

/** Metadata keys that carry the order's margins */
const STAFF_ONLY_METADATA_KEYS = ['bespokePricing', 'before'];

/**
 * An activity log entry as a partner or distributor may see it
 *
 * @example
 *   partnerSafeActivity({ ...log, metadata: { bespokePricing: {} } });
 *   // { ...log, metadata: {} }
 *
 * @param log - The activity log row
 * @returns The row without margin figures in its metadata
 */
export const partnerSafeActivity = <T extends { metadata: unknown }>(
  log: T,
): T => {
  if (!log.metadata || typeof log.metadata !== 'object') return log;

  const metadata = { ...(log.metadata as Record<string, unknown>) };
  for (const key of STAFF_ONLY_METADATA_KEYS) delete metadata[key];

  return { ...log, metadata };
};
