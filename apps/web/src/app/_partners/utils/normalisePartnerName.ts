/**
 * Reduce a business name to what makes it the same business
 *
 * "Craft & Culture", "Craft and Culture FZE" and "CRAFT & CULTURE LLC" are one
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
 *   normalisePartnerName('CRAFT AND CULTURE'); // 'craft and culture'
 *
 * @param name - The business name as written
 * @returns A comparison key, or '' when the name carries nothing to compare
 */
const SUFFIXES =
  /\s+(fze|fzc|fzco|llc|l\.l\.c|ltd|limited|inc|gmbh|sa|srl|bv|aps|as|ab|plc|co|company|trading|group|holdings)$/;

/**
 * The merge tool annotates a retired record as "X (merged into Y)". That is
 * bookkeeping about the record, not part of the business's name — and leaving
 * it in the key made merging a one-way door: the annotated record no longer
 * grouped with its survivor, so the duplicate finder could not see it, and
 * anything that later attached to it (an order raised against the retired id)
 * could never be swept up through the UI. Stripped before comparison so a
 * merged record still groups with the business it belongs to.
 */
const MERGE_ANNOTATION = /\s*\(merged into .*\)\s*$/i;

const normalisePartnerName = (name: string) => {
  let withoutAnnotation = name;
  let previousName = '';

  // Repeatedly: a record merged twice carries the annotation twice.
  while (withoutAnnotation !== previousName) {
    previousName = withoutAnnotation;
    withoutAnnotation = withoutAnnotation.replace(MERGE_ANNOTATION, '').trim();
  }

  let key = withoutAnnotation
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
