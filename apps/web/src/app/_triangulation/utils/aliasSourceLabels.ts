import type { TriAliasSource } from '../schemas/triangulationSchemas';

/**
 * What each code vocabulary is called on screen.
 *
 * These name whose *codes* a file speaks, not whose wine it is. The stored
 * value for our own house codes is `crurated`, for the historical reason that
 * Crurated were the only party issuing them — so an unlabelled badge printed
 * "crurated" against Cult Wines' own invoice and read as the wine having been
 * filed under the wrong client.
 *
 * The stored values are left alone; every alias in the database carries them.
 * Only what a person reads is changed.
 */
const aliasSourceLabels: Record<TriAliasSource, string> = {
  city_drinks: 'City Drinks codes',
  crurated: 'Owner / internal codes',
  zoho: 'Zoho item codes',
  packing_list: 'Packing list codes',
  other: 'Other codes',
};

export default aliasSourceLabels;
