/**
 * Break a search phrase into the words a name must contain to match
 *
 * Party names are written differently in every system — "C D General Trading
 * L.L.C" in Zoho, "Crurated" or "Crurated SRL" as a stock owner. An exact or
 * substring match fails on the spacing, the punctuation and the words in
 * between, and fails silently: the sync simply finds nothing.
 *
 * Requiring every word of the search to appear in the name, with both sides
 * stripped to letters and digits, tolerates all of that while still refusing a
 * genuinely different party.
 *
 * @example
 *   tokenizeMatch('CD General'); // ['CD', 'GENERAL'] — matches 'C D General Trading L.L.C'
 *
 * @param phrase - What the user typed
 * @returns The uppercased words, empty when the phrase has nothing usable
 */
const tokenizeMatch = (phrase: string | null | undefined) => {
  if (!phrase) {
    return [];
  }

  return phrase
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
};

export default tokenizeMatch;
