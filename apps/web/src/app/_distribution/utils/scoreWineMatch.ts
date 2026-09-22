/** Words that appear on half the labels in Bordeaux and distinguish nothing */
const NOISE =
  /\b(chateau|château|domaine|tenuta|cru|classe|classé|grand|premier|1er|2eme|3eme|4eme|5eme|eme|the|de|di|du|des|la|le|les|el|and|et|wine|wines|bottle|bottles|case|nv)\b/g;

/** Vintage anywhere in the name */
const VINTAGE = /\b(19|20)\d{2}\b/;

/** "6x75cl", "75cl", "1.5L" — the format, where the name states one */
const SIZE = /(\d+(?:\.\d+)?)\s*(cl|ml|l)\b/i;

const words = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, ' ')
    .replace(NOISE, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1);

const sizeInCl = (value: string) => {
  const found = SIZE.exec(value);

  if (!found) return null;

  const amount = Number(found[1]);
  const unit = found[2]!.toLowerCase();

  if (unit === 'l') return amount * 100;
  if (unit === 'ml') return amount / 10;

  return amount;
};

export interface WineMatchScore {
  /** 0 to 1 — the share of distinguishing words the two names share */
  score: number;
  /** Why it was rejected outright, if it was */
  rejected: string | null;
}

/**
 * How alike two wine names are — for ranking, never for deciding
 *
 * This ranks candidates for a person to choose between. It does not, and
 * cannot, decide: "Margaux" is both a château and the appellation half of
 * Bordeaux sits in, so "Chateau Margaux 2017" is a perfect containment match
 * for "Rauzan-Ségla Margaux 2017" and no amount of tuning makes that go away.
 * An earlier attempt to let names decide matched ten of thirteen wines and got
 * every one wrong — Insignia to Opus One, Talbot to Mouton Rothschild.
 *
 * So the contract is narrow: put the right wine near the top of a short list.
 * Confirmation is a human act, and the arithmetic afterwards is the real
 * check — a wrong link usually makes stock plus sales exceed what was ever
 * invoiced out.
 *
 * Vintage and size are hard filters rather than contributions. A 2017 is not a
 * near-miss for a 2019 and a magnum is not a near-miss for a bottle; treating
 * either as similarity is how a confident wrong answer gets produced.
 *
 * @param ours - The wine as our invoice names it
 * @param theirs - The wine as the distributor names it
 * @returns A rank between 0 and 1, and the reason if rejected outright
 */
const scoreWineMatch = (ours: string, theirs: string): WineMatchScore => {
  const ourVintage = VINTAGE.exec(ours)?.[0];
  const theirVintage = VINTAGE.exec(theirs)?.[0];

  if (ourVintage && theirVintage && ourVintage !== theirVintage) {
    return { score: 0, rejected: `vintage ${ourVintage} against ${theirVintage}` };
  }

  const ourSize = sizeInCl(ours);
  const theirSize = sizeInCl(theirs);

  if (ourSize && theirSize && Math.abs(ourSize - theirSize) > 1) {
    return { score: 0, rejected: `size ${ourSize}cl against ${theirSize}cl` };
  }

  const mine = new Set(words(ours));
  const yours = new Set(words(theirs));

  if (mine.size === 0 || yours.size === 0) {
    return { score: 0, rejected: 'nothing distinguishing in the name' };
  }

  let shared = 0;

  for (const word of mine) {
    if (yours.has(word)) shared += 1;
  }

  /*
    Containment blended with overlap. Containment alone lets a one-word name
    match anything that contains it; overlap alone punishes a distributor's
    longer description of a wine we name briefly. Together they rank the right
    wine above the wrong one, which is all this is for.
  */
  const containment = shared / Math.min(mine.size, yours.size);
  const overlap = shared / (mine.size + yours.size - shared);

  return { score: (containment + overlap) / 2, rejected: null };
};

export default scoreWineMatch;
