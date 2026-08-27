export interface PricingBand {
  /** Null for the house band; set for an owner's own band. */
  ownerId: string | null;
  minLandedPerBottle: number;
  /** Null = no upper limit. */
  maxLandedPerBottle: number | null;
  b2bMarginPct: number;
  pcMarginPct: number;
}

export interface MarginInputs {
  /** Landed cost per bottle — what decides the band. */
  landedPerBottle: number;
  /** The stock owner, so an owner's own bands win over the house ones. */
  ownerId?: string | null;
  /** Per-line overrides; these always win. */
  lineB2bPct?: number | null;
  linePcPct?: number | null;
  /** The owner's flat percentages, used when no band matches. */
  ownerB2bPct?: number | null;
  ownerPcPct?: number | null;
  bands: PricingBand[];
}

export type MarginSource = 'line' | 'owner-band' | 'house-band' | 'owner' | 'default';

/** Last resort, matching the historic flat rate. */
const DEFAULT_MARGIN_PCT = 10;

const isUsable = (pct: number | null | undefined): pct is number =>
  typeof pct === 'number' && Number.isFinite(pct) && pct < 100;

/**
 * Decide the B2B and Private Client margins for one wine.
 *
 * Precedence, most specific first:
 *
 * 1. a per-line override on the wine
 * 2. a band belonging to the wine's owner
 * 3. the house band
 * 4. the owner's flat percentage
 * 5. 10%, the historic flat rate
 *
 * The two books are resolved independently: a wine can take its B2B margin from
 * a band and its PC margin from a per-line override. Each price is then a
 * margin over LANDED — `landed / (1 - pct/100)` — so PC no longer compounds on
 * top of the B2B price, and changing one book cannot silently move the other.
 *
 * A margin of 100% or more would divide by zero, so it is ignored in favour of
 * the next source down.
 *
 * @example
 *   resolvePricingMargins({
 *     landedPerBottle: 64.17,
 *     bands: [{ ownerId: null, minLandedPerBottle: 50, maxLandedPerBottle: 200, b2bMarginPct: 20, pcMarginPct: 35 }],
 *   });
 *   // { b2bPct: 20, pcPct: 35, b2bSource: 'house-band', pcSource: 'house-band' }
 *
 * @param inputs - The wine's landed cost, its owner, any overrides and the bands
 * @returns The margin for each book and where it came from
 */
const resolvePricingMargins = ({
  landedPerBottle,
  ownerId,
  lineB2bPct,
  linePcPct,
  ownerB2bPct,
  ownerPcPct,
  bands,
}: MarginInputs) => {
  const matches = (band: PricingBand) =>
    landedPerBottle >= band.minLandedPerBottle &&
    (band.maxLandedPerBottle == null ||
      landedPerBottle < band.maxLandedPerBottle);

  // Narrowest first, so a tightly-drawn band beats a catch-all covering it.
  const width = (band: PricingBand) =>
    band.maxLandedPerBottle == null
      ? Number.POSITIVE_INFINITY
      : band.maxLandedPerBottle - band.minLandedPerBottle;

  const candidates = bands.filter(matches).sort((a, b) => width(a) - width(b));
  const ownerBand = ownerId
    ? candidates.find((band) => band.ownerId === ownerId)
    : undefined;
  const houseBand = candidates.find((band) => band.ownerId == null);

  const pick = (
    line: number | null | undefined,
    fromOwnerBand: number | undefined,
    fromHouseBand: number | undefined,
    ownerFlat: number | null | undefined,
  ): { pct: number; source: MarginSource } => {
    if (isUsable(line)) return { pct: line, source: 'line' };
    if (isUsable(fromOwnerBand))
      return { pct: fromOwnerBand, source: 'owner-band' };
    if (isUsable(fromHouseBand))
      return { pct: fromHouseBand, source: 'house-band' };
    if (isUsable(ownerFlat)) return { pct: ownerFlat, source: 'owner' };
    return { pct: DEFAULT_MARGIN_PCT, source: 'default' };
  };

  const b2b = pick(
    lineB2bPct,
    ownerBand?.b2bMarginPct,
    houseBand?.b2bMarginPct,
    ownerB2bPct,
  );
  const pc = pick(
    linePcPct,
    ownerBand?.pcMarginPct,
    houseBand?.pcMarginPct,
    ownerPcPct,
  );

  return {
    b2bPct: b2b.pct,
    pcPct: pc.pct,
    b2bSource: b2b.source,
    pcSource: pc.source,
    /** landed / (1 - pct/100), the price both books are built from. */
    priceFor: (pct: number) =>
      pct >= 100 ? 0 : landedPerBottle / (1 - pct / 100),
  };
};

export default resolvePricingMargins;
