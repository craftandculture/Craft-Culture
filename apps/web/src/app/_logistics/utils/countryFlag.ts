/** Countries shipments come from or go to, by the names the team types */
const ISO_BY_NAME: Record<string, string> = {
  'united kingdom': 'GB', uk: 'GB', 'great britain': 'GB', england: 'GB', scotland: 'GB',
  france: 'FR', switzerland: 'CH', italy: 'IT', spain: 'ES', portugal: 'PT', germany: 'DE',
  austria: 'AT', belgium: 'BE', netherlands: 'NL', luxembourg: 'LU', greece: 'GR', hungary: 'HU',
  'united states': 'US', usa: 'US', 'united states of america': 'US', australia: 'AU',
  'new zealand': 'NZ', 'south africa': 'ZA', chile: 'CL', argentina: 'AR', lebanon: 'LB',
  'hong kong': 'HK', singapore: 'SG', japan: 'JP', china: 'CN', ireland: 'IE', denmark: 'DK',
  'united arab emirates': 'AE', uae: 'AE', 'saudi arabia': 'SA', oman: 'OM', bahrain: 'BH', qatar: 'QA',
};

/**
 * A country's flag as an emoji, from its name or two-letter code
 *
 * @example
 *   countryFlag('France'); // '🇫🇷'
 *   countryFlag('Atlantis'); // null
 */
const countryFlag = (country: string | null | undefined) => {
  if (!country) return null;
  const trimmed = country.trim();
  const iso = /^[A-Za-z]{2}$/.test(trimmed) ? trimmed.toUpperCase() : ISO_BY_NAME[trimmed.toLowerCase()];
  if (!iso) return null;
  return String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
};

export default countryFlag;
