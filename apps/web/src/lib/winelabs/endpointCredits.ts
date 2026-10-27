/**
 * Credits Wine Labs charges per call, from the account's Data API page
 * (Oct 2026): Core calls 8, Markets calls 10, exchange calls 15
 */
const endpointCredits = {
  match_to_lwin: 8,
  wine_info: 8,
  price_stats: 10,
  'exchange/orderbook': 15,
  'exchange/trades': 15,
} as const;

export type WinelabsEndpoint = keyof typeof endpointCredits;

export default endpointCredits;
