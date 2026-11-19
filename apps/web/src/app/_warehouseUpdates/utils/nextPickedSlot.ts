import gulfTime from './gulfTime';

/** Gulf-time hours at which grouped picked & packed updates go */
export const PICKED_SLOT_HOURS = [11, 16];

/**
 * When a grouped picked & packed update is next sent: 11:00 or 16:00 Gulf
 * time, Monday to Saturday
 *
 * A pick finished after 16:00 waits for 11:00 the next working day; the
 * 17:00 summary already shows it as packed.
 *
 * @example
 *   nextPickedSlot(new Date('2026-11-19T05:00:00Z')); // 09:00 Gulf → 11:00 Gulf the same day
 *
 * @param now - When the pick list was completed
 * @returns The moment the update is due
 */
const nextPickedSlot = (now: Date) => {
  const today = gulfTime(now);
  for (let offset = 0; offset <= 7; offset += 1) {
    for (const hour of PICKED_SLOT_HOURS) {
      const slot = new Date(Date.UTC(today.year, today.month, today.date + offset, hour - 4));
      if (gulfTime(slot).weekday !== 0 && slot > now) return slot;
    }
  }
  return now;
};

export default nextPickedSlot;
