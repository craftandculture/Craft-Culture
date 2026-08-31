/** One row of our own catalogue a purchase-order line could mean. */
export interface CatalogueCandidate {
  lwin18: string;
  wine: string;
  producer?: string | null;
  /** Four digits, or "NV". */
  vintage: string;
  sizeMl: number;
  /** Bottles per case on this row. */
  pack: number;
  /** Bottles free on this row alone. */
  bottles: number;
  source: 'stock' | 'inbound';
}

export interface LpoMatchInput {
  /** The client's own wording. */
  wine: string;
  vintage: string;
  sizeMl: number;
  /** Bottles ordered. */
  bottles: number;
  candidates: CatalogueCandidate[];
}

export interface LpoMatch {
  /** The best row's code, or null when nothing was confidently identified. */
  lwin18: string | null;
  /** Our name for what we think they mean. */
  matchedWine: string | null;
  score: number;
  verdict: string;
  /** Bottles held across EVERY pack of this wine, vintage and size. */
  availableBottles: number;
  inboundBottles: number;
  /** True when filling the order leaves none of this wine behind. */
  takesLastBottles: boolean;
  /** The packs this wine is actually held in, best first. */
  rows: CatalogueCandidate[];
  /** Shown when the match is refused or close, so a person can settle it. */
  shortlist: { lwin18: string; wine: string; score: number }[];
}

/** Below this, a name has not been identified at all. */
const MIN_SCORE = 0.5;
/** A clear winner is arithmetic; two close names are a person's judgement. */
const MIN_MARGIN = 0.1;

/** Words every second Bordeaux carries, which therefore identify nothing. */
const NOISE =
  /\b(chateau|ch|domaine|dom|the|de|du|des|la|le|les|1er|2eme|3eme|4eme|5eme|premier|deuxieme|grand|cru|classe|class|a|b|vineyard|winery|estate)\b/g;

/** As `_wms` does it: strip the accents, keep the letters. */
const deburr = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Reduce a wine name to the words that actually identify it.
 *
 * Accents go because a client types "Chateau" for "Château"; punctuation goes
 * because "Grand-Puy-Lacoste" and "Grand Puy Lacoste" are one wine.
 */
const tokens = (name: string) =>
  new Set(
    deburr(String(name ?? ''))
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(NOISE, ' ')
      .split(/\s+/)
      .filter(Boolean),
  );

/**
 * How much two names agree, from 0 to 1.
 *
 * Containment carries most of the weight because the client writes the short
 * form of a name we hold in full — "Alter Ego, Margaux" against "Alter Ego de
 * Chateau Palmer, Margaux". Overlap is mixed in to hold back the failure that
 * pure containment invites, where a two-word name sits inside a longer
 * different wine: "Opus One" is wholly contained in "Opus One Overture".
 */
const similarity = (left: Set<string>, right: Set<string>) => {
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;

  const containment = shared / Math.min(left.size, right.size);
  const overlap = shared / (left.size + right.size - shared);

  return 0.7 * containment + 0.3 * overlap;
};

/** LWIN18 is wine-vintage-pack-size; the wine and its size are its identity. */
const identityOf = (lwin18: string) => {
  const parts = String(lwin18 ?? '').split('-');
  return parts.length === 4 ? `${parts[0]}-${parts[1]}-${parts[3]}` : lwin18;
};

/**
 * Work out which wine a purchase-order line means, and whether we hold it.
 *
 * Vintage and bottle size are treated as identity, not similarity: a client
 * ordering the 1996 has not ordered the 1998, and a 6L Imperial is not the
 * 75cl however alike the names read. Only the name is scored, and only among
 * rows that already agree on both.
 *
 * Availability is then summed across **every pack** of that wine — a 3-pack
 * row, a 6-pack row and loose bottles are all the same wine on a shelf. Reading
 * stock off the single matched row is what once reported seven lines
 * unfulfillable when every bottle was in the building, sitting under a
 * different pack.
 *
 * @example
 *   matchLpoLine({ wine: 'Chateau Hosanna, Pomerol', vintage: '1999',
 *                  sizeMl: 750, bottles: 3, candidates });
 *   // -> 12 available, across the 3-pack rows
 *
 * @param input - The ordered line and the catalogue rows to choose from
 * @returns The identified wine, what we hold of it, and the shortlist
 */
const matchLpoLine = ({
  wine,
  vintage,
  sizeMl,
  bottles,
  candidates,
}: LpoMatchInput): LpoMatch => {
  const empty = {
    lwin18: null,
    matchedWine: null,
    availableBottles: 0,
    inboundBottles: 0,
    takesLastBottles: false,
    rows: [],
  };

  const wanted = tokens(wine);
  if (wanted.size === 0) {
    return { ...empty, score: 0, verdict: 'Nothing searchable in the name', shortlist: [] };
  }

  const eligible = candidates.filter(
    (candidate) => candidate.vintage === vintage && candidate.sizeMl === sizeMl,
  );

  if (eligible.length === 0) {
    return {
      ...empty,
      score: 0,
      verdict: `Nothing on file for ${vintage} at ${sizeMl}ml`,
      shortlist: [],
    };
  }

  const scored = eligible
    .map((candidate) => ({
      candidate,
      score: similarity(
        wanted,
        tokens(`${candidate.producer ?? ''} ${candidate.wine}`),
      ),
    }))
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  const shortlist = scored.slice(0, 4).map(({ candidate, score }) => ({
    lwin18: candidate.lwin18,
    wine: candidate.wine,
    score: Math.round(score * 100) / 100,
  }));

  if (!best || best.score < MIN_SCORE) {
    return {
      ...empty,
      score: best?.score ?? 0,
      verdict: 'No name close enough to be sure',
      shortlist,
    };
  }

  // Packs of the SAME wine are not rivals — they are the same answer written
  // twice — so the margin is measured against the nearest DIFFERENT wine.
  const winningIdentity = identityOf(best.candidate.lwin18);
  const rival = scored.find(
    ({ candidate }) => identityOf(candidate.lwin18) !== winningIdentity,
  );
  const margin = best.score - (rival?.score ?? 0);

  if (rival && margin < MIN_MARGIN) {
    return {
      ...empty,
      score: best.score,
      verdict: `Too close to call against "${rival.candidate.wine}"`,
      shortlist,
    };
  }

  const rows = eligible
    .filter((candidate) => identityOf(candidate.lwin18) === winningIdentity)
    .sort((left, right) => right.bottles - left.bottles);

  const sum = (source: CatalogueCandidate['source']) =>
    rows
      .filter((row) => row.source === source)
      .reduce((total, row) => total + row.bottles, 0);

  const availableBottles = sum('stock');

  return {
    lwin18: best.candidate.lwin18,
    matchedWine: best.candidate.wine,
    score: Math.round(best.score * 100) / 100,
    verdict: 'Matched',
    availableBottles,
    inboundBottles: sum('inbound'),
    takesLastBottles: availableBottles > 0 && availableBottles === bottles,
    rows,
    shortlist,
  };
};

export default matchLpoLine;
