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
  // Get countries with counts
  const countriesResult = await db
    .select({
      value: products.country,
      count: sql<number>`COUNT(DISTINCT ${products.id})`,
    })
    .from(products)
    .where(sql`${products.country} IS NOT NULL AND ${products.country} != ''`)
    .groupBy(products.country)
    .orderBy(products.country);

  // Get regions with their associated countries and counts
  const regionsResult = await db
    .select({
      region: products.region,
      country: products.country,
      count: sql<number>`COUNT(DISTINCT ${products.id})`,
    })
    .from(products)
    .where(sql`${products.region} IS NOT NULL AND ${products.region} != ''`)
    .groupBy(products.region, products.country)
    .orderBy(products.region);

  // Get producers with their associated countries and counts
  const producersResult = await db
    .select({
      producer: products.producer,
      country: products.country,
      count: sql<number>`COUNT(DISTINCT ${products.id})`,
    })
    .from(products)
    .where(
      sql`${products.producer} IS NOT NULL AND ${products.producer} != ''`,
    )
    .groupBy(products.producer, products.country)
    .orderBy(products.producer);

  // Get vintages with their associated countries and counts
  const vintagesResult = await db
    .select({
      vintage: products.year,
      country: products.country,
      count: sql<number>`COUNT(DISTINCT ${products.id})`,
    })
    .from(products)
    .where(sql`${products.year} IS NOT NULL`)
    .groupBy(products.year, products.country)
    .orderBy(sql`${products.year} DESC`);

  return {
    countriesWithCounts: countriesResult
      .filter((c): c is { value: string; count: number } => !!c.value)
      .map(({ value, count }) => ({ value, count })),
    regionsByCountryWithCounts: regionsResult
      .filter(
        (r): r is { region: string; country: string; count: number } =>
          !!r.region,
      )
      .reduce(
        (acc, { region, country, count }) => {
          const countryKey = country ?? 'Unknown';
          if (!acc[countryKey]) {
            acc[countryKey] = [];
          }
          const existing = acc[countryKey].find((r) => r.value === region);
          if (!existing) {
            acc[countryKey].push({ value: region, count });
          } else {
            existing.count += count;
          }
          return acc;
        },
        {} as Record<string, Array<{ value: string; count: number }>>,
      ),
    producersByCountryWithCounts: producersResult
      .filter(
        (p): p is { producer: string; country: string; count: number } =>
          !!p.producer,
      )
      .reduce(
        (acc, { producer, country, count }) => {
          const countryKey = country ?? 'Unknown';
          if (!acc[countryKey]) {
            acc[countryKey] = [];
          }
          const existing = acc[countryKey].find((p) => p.value === producer);
          if (!existing) {
            acc[countryKey].push({ value: producer, count });
          } else {
            existing.count += count;
          }
          return acc;
        },
        {} as Record<string, Array<{ value: string; count: number }>>,
      ),
    vintagesByCountryWithCounts: vintagesResult
      .filter(
        (v): v is { vintage: number; country: string; count: number } =>
          v.vintage !== null,
      )
      .reduce(
        (acc, { vintage, country, count }) => {
          const countryKey = country ?? 'Unknown';
          if (!acc[countryKey]) {
            acc[countryKey] = [];
          }
          const existing = acc[countryKey].find((v) => v.value === vintage);
          if (!existing) {
            acc[countryKey].push({ value: vintage, count });
          } else {
            existing.count += count;
          }
          return acc;
        },
        {} as Record<string, Array<{ value: number; count: number }>>,
      ),
  };
});

export type ProductsGetFilterOptionsOutput = Awaited<
  ReturnType<typeof productsGetFilterOptions>
>;

export default productsGetFilterOptions;
