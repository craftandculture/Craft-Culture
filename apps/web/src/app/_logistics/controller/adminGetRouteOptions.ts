import { count, sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsQuoteRequests, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import normaliseCountry from '../utils/normaliseCountry';

/** Offered from the start, before the Index has seen a route */
const PRESETS = {
  countries: ['United Kingdom', 'United Arab Emirates', 'France', 'Italy', 'Switzerland', 'Spain', 'Portugal', 'Germany', 'United States'],
  cities: ['Burton upon Trent', 'London', 'Tilbury', 'Bordeaux', 'Beaune', 'Reims', 'Ras Al Khaimah', 'Dubai', 'Abu Dhabi'],
  warehouses: ['LCB Burton Gateway', 'LCB Tilbury', 'C&C bonded warehouse', 'RAK Port'],
};

type Kind = keyof typeof PRESETS;

/**
 * The places routes have used, for the route fields to suggest
 *
 * Every country, city and warehouse on past quote requests and shipments,
 * most used first, with the usual C&C places added so the lists are useful
 * from the first request. People can still type anything not listed.
 *
 * @example
 *   await trpcClient.logistics.admin.requests.routeOptions.query(); // { countries: [...], cities: [...], warehouses: [...] }
 */
const adminGetRouteOptions = adminProcedure.query(async () => {
  const columns = {
    countries: [
      [logisticsQuoteRequests, logisticsQuoteRequests.originCountry],
      [logisticsQuoteRequests, logisticsQuoteRequests.destinationCountry],
      [logisticsShipments, logisticsShipments.originCountry],
      [logisticsShipments, logisticsShipments.destinationCountry],
    ],
    cities: [
      [logisticsQuoteRequests, logisticsQuoteRequests.originCity],
      [logisticsQuoteRequests, logisticsQuoteRequests.destinationCity],
      [logisticsShipments, logisticsShipments.originCity],
      [logisticsShipments, logisticsShipments.destinationCity],
    ],
    warehouses: [
      [logisticsQuoteRequests, logisticsQuoteRequests.originWarehouse],
      [logisticsQuoteRequests, logisticsQuoteRequests.destinationWarehouse],
      [logisticsShipments, logisticsShipments.originWarehouse],
      [logisticsShipments, logisticsShipments.destinationWarehouse],
    ],
  } as const;

  const tally = async (kind: Kind) => {
    const uses = new Map<string, { name: string; uses: number }>();
    const add = (raw: string | null, n: number) => {
      const name = raw ? (kind === 'countries' ? normaliseCountry(raw) : raw.trim()) : '';
      if (!name) return;
      const key = name.toLowerCase();
      const seen = uses.get(key);
      uses.set(key, { name: seen?.name ?? name, uses: (seen?.uses ?? 0) + n });
    };

    const rows = await Promise.all(
      columns[kind].map(([table, column]) =>
        db
          .select({ value: column, uses: count() })
          .from(table)
          .where(sql`${column} IS NOT NULL AND trim(${column}) <> ''`)
          .groupBy(column),
      ),
    );
    rows.flat().forEach((r) => add(r.value, r.uses));
    PRESETS[kind].forEach((p) => add(p, 0));

    return [...uses.values()].sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name)).map((u) => u.name);
  };

  const [countries, cities, warehouses] = await Promise.all([tally('countries'), tally('cities'), tally('warehouses')]);

  return { countries, cities, warehouses };
});

export default adminGetRouteOptions;
