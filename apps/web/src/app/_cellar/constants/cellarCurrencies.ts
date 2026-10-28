/**
 * The currencies a member can read and set prices in
 *
 * USD first: it is the base everything is held and settled in. The others
 * only change how a figure is read, or what a member types an asking price
 * in, which is converted to USD on the day it is listed.
 */
const CELLAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'AED'] as const;

export type CellarCurrency = (typeof CELLAR_CURRENCIES)[number];

export default CELLAR_CURRENCIES;
