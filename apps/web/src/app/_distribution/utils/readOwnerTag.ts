/**
 * The owner tag inside a subject line
 *
 * `CONSIGNMENT_CULT` names Cult; `CONSIGNMENT_MIX` names several and so names
 * none. Returned as the bare tag, because that is what an owner is keyed on —
 * passing the whole subject instead squashes to `CONSIGNMENTCULT`, matches no
 * owner, and sends the line to whoever takes unattributed. Every invoice that
 * had been carefully tagged then landed under one owner and the per-owner
 * split, the entire point of the module, was silently inert.
 *
 * Reading only the word that follows `CONSIGNMENT` was the same mistake in a
 * smaller place. Subjects are written by people: "CRU Consignment Replenish"
 * names Cru and then says what the shipment was for, and taking the word after
 * the keyword read the owner as `REPLENISH`, matched nobody, and handed twelve
 * bottles of Guidalberto to whoever takes the unattributed. So where the known
 * tags are passed in, every word is considered, only a real owner tag is
 * returned, and a subject containing none returns nothing at all rather than
 * whatever word sat in the right place.
 *
 * @example
 *   readOwnerTag('CONSIGNMENT_CULT'); // 'CULT'
 *   readOwnerTag('SO-00105 CONSIGNMENT_CRU'); // 'CRU'
 *   readOwnerTag('CRU Consignment Replenish', ['CRU', 'CULT']); // 'CRU'
 *   readOwnerTag('CONSIGNMENT_MIX'); // null — several owners, so none
 *
 * @param subject - The subject line, reference number, or line description
 * @param knownTags - The owner tags on file, so a word can be tested for being
 *   one rather than assumed from where it sits
 * @returns The tag, or null when there is none or it names several owners
 */
const readOwnerTag = (
  subject: string | null | undefined,
  knownTags?: readonly string[],
) => {
  const text = subject ?? '';

  /* Several owners named is not an owner, however the rest of it reads */
  if (/CONSIGNMENT[_\s-]*MIX\b/i.test(text)) return null;

  /*
    A word that is actually an owner beats a word that merely sits in the
    right place. Longest first, so CRURATED is never read as CRU.
  */
  if (knownTags?.length) {
    const words = text.toUpperCase().match(/[A-Z]+/g) ?? [];
    const wanted = [...knownTags]
      .map((tag) => tag.toUpperCase())
      .sort((a, b) => b.length - a.length);

    for (const word of words) {
      const hit = wanted.find((tag) => tag === word);

      if (hit) return hit;
    }

    /*
      Known tags and none of them present means nobody was named, and saying
      so is the point. Falling back to the word after the keyword is what read
      "Consignment Replenish" as an owner called REPLENISH.
    */
    return null;
  }

  const found = /CONSIGNMENT[_\s-]*([A-Z]+)/i.exec(text);
  const tag = found?.[1]?.toUpperCase() ?? null;

  if (!tag || tag === 'MIX') return null;

  return tag;
};

export default readOwnerTag;
