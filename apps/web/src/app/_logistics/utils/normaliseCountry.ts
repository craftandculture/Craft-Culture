/** Short forms people type, and the name a route is kept under */
const ALIASES: Record<string, string> = {
  uk: 'United Kingdom',
  gb: 'United Kingdom',
  'great britain': 'United Kingdom',
  england: 'United Kingdom',
  uae: 'United Arab Emirates',
  ae: 'United Arab Emirates',
  emirates: 'United Arab Emirates',
  usa: 'United States',
  us: 'United States',
  fr: 'France',
  it: 'Italy',
  ch: 'Switzerland',
  es: 'Spain',
  pt: 'Portugal',
  de: 'Germany',
  dk: 'Denmark',
  za: 'South Africa',
  au: 'Australia',
  nz: 'New Zealand',
};

/**
 * Keep a country under one name
 *
 * "UK" and "United Kingdom" would otherwise be two routes, so the forwarders
 * used on a route and the last client price charged on it would not be found.
 *
 * @example
 *   normaliseCountry(' uk '); // 'United Kingdom'
 *   normaliseCountry('France'); // 'France'
 *
 * @param country - The country as typed
 * @returns The full name for a known short form, otherwise the input trimmed
 */
const normaliseCountry = (country: string) => {
  const trimmed = country.trim();

  return ALIASES[trimmed.toLowerCase().replace(/\./g, '')] ?? trimmed;
};

export default normaliseCountry;
