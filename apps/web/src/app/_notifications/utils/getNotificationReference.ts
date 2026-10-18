/*
  Our document numbers: a short prefix, the year, a sequence
  (REL-2026-0008, UKM-2026-0001, PCO-2026-00418).
*/
const REFERENCE = /\b[A-Z]{2,4}-20\d{2}-\d{3,6}\b/;

/**
 * The first document number a notification mentions, if any
 *
 * Shown as a chip so the reader can spot which record it is without reading
 * the sentence.
 *
 * @example
 *   getNotificationReference('Asked on REL-2026-0008.'); // 'REL-2026-0008'
 *
 * @param text - The notification's title and message
 * @returns The reference, or null when there is none
 */
const getNotificationReference = (text: string) =>
  REFERENCE.exec(text)?.[0] ?? null;

export default getNotificationReference;
