/**
 * Shared constants for the sales-quote renderer.
 *
 * Kept in step with cc-marketing-site/quote-builder/build_quote.py so the
 * Python builder and this renderer produce identical markup.
 */

/** Rate used to derive AED when a line carries no sheet-native AED price. */
export const AED_PER_USD = 3.6725;

/** Pseudo-region always rendered as the last section of a quote. */
export const INBOUND = 'Inbound — In Transit';

/** Default section order; regions not listed fall to the end, alphabetically. */
export const DEFAULT_REGION_ORDER = [
  'Bordeaux',
  'Burgundy',
  'Rhône Valley',
  'Champagne',
  'Tuscany',
  'Spain',
  'Chile',
  'Australia',
  'Napa Valley',
  INBOUND,
];

/** Inline bottle glyph for the large-format chip. */
export const MAGNUM_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M9.5 2h5M10.5 2v3.8c0 .6-.25 1.15-.7 1.55L8.2 8.7C7.45 9.4 7 10.4 7 11.45V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-8.55c0-1.05-.45-2.05-1.2-2.75L14.2 7.35c-.45-.4-.7-.95-.7-1.55V2"/></svg>';

/** Inline glyph shown beside a line note. */
export const NOTE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.36 2.64L3 8"/><path d="M3 3v5h5"/></svg>';
