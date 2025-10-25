import { sql } from 'drizzle-orm';

import db from '@/database/client';
import { products } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

/**
 * Get distinct filter options for products with country associations
 *
 * @example
 *   const filterOptions = await api.products.getFilterOptions.query();
 */
const productsGetFilterOptions = protectedProcedure.query(async () => {
  const countriesResult = await db
    .selectDistinct({ value: products.country })
    .from(products)
    .where(sql`${products.country} IS NOT NULL AND ${products.country} != ''`)
    .orderBy(products.country);

  // Get regions with their associated countries
  const regionsResult = await db
    .selectDistinct({
      region: products.region,
      country: products.country,
    })
    .from(products)
    .where(sql`${products.region} IS NOT NULL AND ${products.region} != ''`)
    .orderBy(products.region);

  // Get producers with their associated countries
  const producersResult = await db
    .selectDistinct({
      producer: products.producer,
      country: products.country,
    })
    .from(products)
    .where(
      sql`${products.producer} IS NOT NULL AND ${products.producer} != ''`,
    )
    .orderBy(products.producer);

  // Get vintages with their associated countries
  const vintagesResult = await db
    .selectDistinct({
      vintage: products.year,
      country: products.country,
    })
    .from(products)
    .where(sql`${products.year} IS NOT NULL`)
    .orderBy(sql`${products.year} DESC`);

  return {
    countries: countriesResult
      .map((c) => c.value)
      .filter((v): v is string => !!v),
    regionsByCountry: regionsResult
      .filter((r): r is { region: string; country: string } => !!r.region)
      .reduce(
        (acc, { region, country }) => {
          const countryKey = country ?? 'Unknown';
          if (!acc[countryKey]) {
            acc[countryKey] = [];
          }
          if (!acc[countryKey].includes(region)) {
            acc[countryKey].push(region);
          }
          return acc;
        },
        {} as Record<string, string[]>,
      ),
    producersByCountry: producersResult
      .filter((p): p is { producer: string; country: string } => !!p.producer)
      .reduce(
        (acc, { producer, country }) => {
          const countryKey = country ?? 'Unknown';
          if (!acc[countryKey]) {
            acc[countryKey] = [];
          }
          if (!acc[countryKey].includes(producer)) {
            acc[countryKey].push(producer);
          }
          return acc;
        },
        {} as Record<string, string[]>,
      ),
    vintagesByCountry: vintagesResult
      .filter((v): v is { vintage: number; country: string } => v.vintage !== null)
      .reduce(
        (acc, { vintage, country }) => {
          const countryKey = country ?? 'Unknown';
          if (!acc[countryKey]) {
            acc[countryKey] = [];
          }
          if (!acc[countryKey].includes(vintage)) {
            acc[countryKey].push(vintage);
          }
          return acc;
        },
        {} as Record<string, number[]>,
      ),
  };
});

export type ProductsGetFilterOptionsOutput = Awaited<
  ReturnType<typeof productsGetFilterOptions>
>;

export default productsGetFilterOptions;
