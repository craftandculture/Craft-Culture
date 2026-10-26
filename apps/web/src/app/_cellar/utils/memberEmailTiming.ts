import {
  MEMBER_EMAIL_MERGE_HOURS,
  MEMBER_EMAIL_QUIET_FROM_HOUR,
  MEMBER_EMAIL_QUIET_UNTIL_HOUR,
} from '../constants/memberEmailEvents';

/** Gulf time, UTC+4 all year */
const GULF_OFFSET_MS = 4 * 60 * 60 * 1000;

const toGulf = (at: Date) => new Date(at.getTime() + GULF_OFFSET_MS);
const fromGulf = (local: Date) => new Date(local.getTime() - GULF_OFFSET_MS);

/**
 * The Gulf calendar day an instant falls on
 *
 * @param at - The instant
 * @returns The day, as YYYY-MM-DD
 */
export const gulfDay = (at: Date) => toGulf(at).toISOString().slice(0, 10);

/**
 * The first moment at or after `at` outside quiet hours (21:00 to 08:00 Gulf)
 *
 * @example
 *   // 22:30 Gulf on Monday becomes 08:00 Gulf on Tuesday
 *   outsideQuietHours(new Date('2026-10-26T18:30:00Z')); // 2026-10-27T04:00:00Z
 *
 * @param at - When the email would otherwise go
 * @returns When it may go
 */
export const outsideQuietHours = (at: Date) => {
  const local = toGulf(at);
  const hour = local.getUTCHours();
  if (hour >= MEMBER_EMAIL_QUIET_UNTIL_HOUR && hour < MEMBER_EMAIL_QUIET_FROM_HOUR) return at;

  const next = new Date(local);
  if (hour >= MEMBER_EMAIL_QUIET_FROM_HOUR) next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(MEMBER_EMAIL_QUIET_UNTIL_HOUR, 0, 0, 0);
  return fromGulf(next);
};

/**
 * The next merge slot (12:00 or 17:00 Gulf) at or after `at`
 *
 * Mergeable updates wait for a slot, so events in the same window combine
 * into one email.
 *
 * @param at - When the event happened
 * @returns When its email goes
 */
export const nextMergeSlot = (at: Date) => {
  const local = toGulf(at);
  for (const hour of MEMBER_EMAIL_MERGE_HOURS) {
    const slot = new Date(local);
    slot.setUTCHours(hour, 0, 0, 0);
    if (slot >= local) return fromGulf(slot);
  }
  const slot = new Date(local);
  slot.setUTCDate(slot.getUTCDate() + 1);
  slot.setUTCHours(MEMBER_EMAIL_MERGE_HOURS[0]!, 0, 0, 0);
  return fromGulf(slot);
};

/**
 * 08:00 Gulf time on the day after `at`, where an update over the daily cap waits
 *
 * @param at - When the email would otherwise go
 * @returns The next morning
 */
export const nextMorning = (at: Date) => {
  const local = toGulf(at);
  local.setUTCDate(local.getUTCDate() + 1);
  local.setUTCHours(MEMBER_EMAIL_QUIET_UNTIL_HOUR, 0, 0, 0);
  return fromGulf(local);
};
