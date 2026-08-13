/** Sequences that only appear when UTF-8 has been read as Western European */
const TELLTALE =
  /â€|[ÂÃ][-¿–—‘-”€™]/;

/**
 * The characters Windows-1252 puts in 0x80–0x9F, which Latin-1 leaves empty.
 *
 * A file mis-decoded as cp1252 turns those bytes into curly quotes, dashes and
 * symbols whose code points sit far above 0xFF, so reading the character code
 * alone loses the byte. This maps them back to the byte they came from.
 */
const CP1252 = new Map<number, number>([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

/**
 * Undo a UTF-8 string that was decoded as Western European
 *
 * `L’If` becomes `Lâ€™If` when the three UTF-8 bytes of the apostrophe are each
 * read as a separate character. The damage is reversible because nothing was
 * lost: the original bytes are still there, one per character, and decoding
 * them as UTF-8 again restores the text.
 *
 * Only attempted on strings carrying a sequence that cannot occur naturally.
 * Wine names legitimately contain `Château` and `Côtes`, and running this over
 * correct text would ruin it.
 *
 * @example
 *   repairMojibake('Lâ€™If Collines'); // 'L’If Collines'
 *   repairMojibake('Château Margaux'); // unchanged
 *
 * @param text - The possibly mis-decoded string
 * @returns The repaired string, or the original when nothing suggests damage
 */
const repairMojibake = (text: string) => {
  if (!TELLTALE.test(text)) return text;

  const bytes: number[] = [];

  for (const character of text) {
    const code = character.charCodeAt(0);
    const byte = code > 0xff ? CP1252.get(code) : code;

    // Not a Western European mis-decode, so reinterpreting would destroy real
    // characters.
    if (byte === undefined) return text;

    bytes.push(byte);
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from(bytes),
    );
  } catch {
    // Not valid UTF-8 underneath, so the damage is something else and the
    // original is the best available answer.
    return text;
  }
};

export default repairMojibake;
