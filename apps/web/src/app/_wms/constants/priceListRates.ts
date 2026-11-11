import DEFAULT_INBOND_MARGIN_PCT from './defaultInbondMarginPct';
import type { PricingManagerRates } from '../utils/pricePricingManagerRow';

/**
 * The rates a price list prices with: the Pricing Manager's "All owners" view
 * with its toolbar at the house defaults
 *
 * Each row then takes a margin typed on the line, else its owner's rate, else
 * the 10% In Bond default; with no PC margin anywhere it falls back to the
 * stored selling price. The Pricing Manager opens with exactly these, so the
 * B2B and PC prices staff see are the ones that publish.
 */
const PRICE_LIST_RATES: PricingManagerRates = {
  ownerSelected: false,
  effInbondPct: DEFAULT_INBOND_MARGIN_PCT,
  effPcPct: null,
  inBondMarkupPct: DEFAULT_INBOND_MARGIN_PCT,
  pcMarginPct: 0,
  ownerPcPrice: null,
};

export default PRICE_LIST_RATES;
