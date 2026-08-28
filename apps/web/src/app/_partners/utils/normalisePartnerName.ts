/**
 * Reduce a business name to what makes it the same business
 *
 * "Craft & Culture", "Craft and Culture FZE" and "CRAFT & CULTURE  LLC" are one
 * counterparty, and they were three different owners in every filter — with
 * separate pricing margins, because those are keyed on the partner record. So
 * punctuation, spacing, case, the ampersand and the registered suffix all come
 * off before two names are compared.
 *
 * Used by the duplicate finder and by both places a partner can be created, so
 * that what counts as "already on file" is one rule rather than three.
 *
 * @example
 *   normalisePartnerName('Craft & Culture FZE'); // 'craft and culture'
 *   normalisePartnerName('CRAFT AND CULTURE');   // 'craft and culture'
 *
 * @param name - The business name as written
 * @returns A comparison key, or '' when the name carries nothing to compare
 */
const SUFFIXES =
  /\s+(fze|fzc|fzco|llc|l\.l\.c|ltd|limited|inc|gmbh|sa|srl|bv|aps|as|ab|plc|co|company|trading|group|holdings)$/;

const normalisePartnerName = (name: string) => {
  let key = name
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  // Repeatedly, because "Trading Group Ltd" carries three of them
  let previous = '';

  while (key !== previous) {
    previous = key;
    key = key.replace(SUFFIXES, '').trim();
  }

  return key;
};

export default normalisePartnerName;
