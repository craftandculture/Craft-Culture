/**
 * How long a member's wine is held while they pay
 *
 * Forty-eight hours rather than twenty-four: a bank transfer will not always
 * clear inside a day, and a reservation that lapses while the money is in
 * flight costs a sale and an apology. Extending doubles it once — beyond that
 * it is a conversation, not a button.
 */
export const RESERVATION_HOURS = 48;

/** One extension, of the same length, and no more without an admin */
export const EXTENSION_HOURS = 48;

/**
 * When a reservation taken now should lapse
 *
 * @param from - The moment the order was placed
 * @returns The expiry
 */
export const reservedUntilFrom = (from: Date) =>
  new Date(from.getTime() + RESERVATION_HOURS * 60 * 60 * 1000);

export default RESERVATION_HOURS;
