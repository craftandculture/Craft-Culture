/**
 * Working days needed to bring wine out of the free zone and deliver it
 *
 * Clearance from the free-zone bond to the mainland, duty and VAT paid, and a
 * licensed delivery slot. The member's quote has to be accepted first, so the
 * count starts from the day they ask, not the day they approve.
 */
export const DELIVERY_LEAD_WORKING_DAYS = 5;

/** The UAE weekend: Saturday and Sunday */
const isWeekend = (date: Date) => date.getUTCDay() === 0 || date.getUTCDay() === 6;

/**
 * The earliest day a member may choose for a delivery, in the UAE's calendar
 *
 * One rule for the date picker and the server, so the form can never offer a
 * day the request then refuses. Counts working days in Dubai (UTC+4 all year),
 * skipping the weekend.
 *
 * @example
 *   earliestDeliveryDate(new Date('2026-10-19T08:00:00Z')); // '2026-10-26'
 *
 * @param now - The moment to count from
 * @returns The first allowed day, as YYYY-MM-DD
 */
const earliestDeliveryDate = (now: Date = new Date()) => {
  const dubai = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const day = new Date(Date.UTC(dubai.getUTCFullYear(), dubai.getUTCMonth(), dubai.getUTCDate()));

  let counted = 0;
  while (counted < DELIVERY_LEAD_WORKING_DAYS) {
    day.setUTCDate(day.getUTCDate() + 1);
    if (!isWeekend(day)) counted += 1;
  }

  return day.toISOString().slice(0, 10);
};

export default earliestDeliveryDate;
