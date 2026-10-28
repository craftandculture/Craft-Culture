/** Stored on a forwarder that collects from anywhere; it covers every route */
export const GLOBAL_COVERAGE = 'Global';

/**
 * Countries a forwarder can collect from, as offered in the forwarder form
 *
 * Names match what `normaliseCountry` keeps a route under, so a forwarder's
 * countries line up with the origin typed on a request.
 */
const forwarderCountries = [
  'Argentina',
  'Australia',
  'Austria',
  'Bahrain',
  'Belgium',
  'Brazil',
  'Canada',
  'Chile',
  'China',
  'Croatia',
  'Cyprus',
  'Czech Republic',
  'Denmark',
  'Egypt',
  'France',
  'Georgia',
  'Germany',
  'Greece',
  'Hong Kong',
  'Hungary',
  'India',
  'Ireland',
  'Israel',
  'Italy',
  'Japan',
  'Jordan',
  'Kuwait',
  'Lebanon',
  'Luxembourg',
  'Malta',
  'Mexico',
  'Monaco',
  'Netherlands',
  'New Zealand',
  'Norway',
  'Oman',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Saudi Arabia',
  'Singapore',
  'Slovenia',
  'South Africa',
  'South Korea',
  'Spain',
  'Sweden',
  'Switzerland',
  'Taiwan',
  'Thailand',
  'Turkey',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
] as const;

export default forwarderCountries;
