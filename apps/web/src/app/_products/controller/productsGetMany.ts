import { sql } from 'drizzle-orm';
import z from 'zod';

import db from '@/database/client';
import { productOffers, products } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

interface PreparedSearch {
  trimmedSearch: string;
  normalizedTokens: string[];
}

const prepareSearch = (rawSearch: string): PreparedSearch | undefined => {
  const trimmedSearch = rawSearch.trim();

  if (trimmedSearch.length === 0) {
    return undefined;
  }

  const normalizedTokens = Array.from(
    new Set(
      trimmedSearch
        .toLowerCase()
        .split(/\s+/)
        .map((token) => token.replace(/[^a-z0-9]/gi, ''))
        .filter((token) => token.length > 1),
    ),
  );

  return { trimmedSearch, normalizedTokens };
};

const createSearchExpressions = (
  tableAlias: typeof products,
  { trimmedSearch, normalizedTokens }: PreparedSearch,
) => {
  const searchVector = sql`
    setweight(to_tsvector('english', coalesce(${tableAlias.name}, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(${tableAlias.producer}, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(${tableAlias.lwin18}, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(${tableAlias.region}, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(${tableAlias.year}::text, '')), 'C')
  `;

  const tsQuery = sql`websearch_to_tsquery('english', ${trimmedSearch})`;

  const buildTokenCondition = (token: string) => {
    const partial = `%${token}%`;
    return sql`
      (
        coalesce(${tableAlias.name}, '') ILIKE ${partial} OR
        coalesce(${tableAlias.producer}, '') ILIKE ${partial} OR
        coalesce(${tableAlias.region}, '') ILIKE ${partial} OR
        coalesce(${tableAlias.lwin18}, '') ILIKE ${partial}
      )
    `;
  };

  const tokenConditions = normalizedTokens.map((token) =>
    buildTokenCondition(token),
  );

  const tokenMatchExpressions = tokenConditions.map(
    (condition) => sql<number>`CASE WHEN ${condition} THEN 1 ELSE 0 END`,
  );

  const tokenMatchCount =
    tokenMatchExpressions.length > 0
      ? sql<number>`(${sql.join(tokenMatchExpressions, sql` + `)})`
      : undefined;

  const enforceTokenMatches = normalizedTokens.length >= 2;
  const tokenMatchThreshold = enforceTokenMatches
    ? Math.max(1, Math.ceil(normalizedTokens.length * 0.6))
    : 0;

  const tokenMatchRatio =
    tokenMatchCount && normalizedTokens.length > 0
      ? sql<number>`(
          CAST(${tokenMatchCount} AS double precision) /
          ${Math.max(1, normalizedTokens.length)}
        )`
      : sql<number>`0`;

  const trigramSimilarity = sql<number>`
    greatest(
      similarity(coalesce(${tableAlias.name}, ''), ${trimmedSearch}),
      similarity(coalesce(${tableAlias.producer}, ''), ${trimmedSearch}),
      similarity(coalesce(${tableAlias.region}, ''), ${trimmedSearch}),
      similarity(coalesce(${tableAlias.lwin18}, ''), ${trimmedSearch})
    )
  `;

  const trigramThreshold = enforceTokenMatches ? 0.25 : 0.12;
  const trigramCondition = sql`${trigramSimilarity} > ${trigramThreshold}`;

  const matchConditions = [sql`${searchVector} @@ ${tsQuery}`];

  matchConditions.push(trigramCondition);

  if (!enforceTokenMatches && tokenMatchCount) {
    matchConditions.push(sql`${tokenMatchCount} >= 1`);
  }

  const likeValue = `%${trimmedSearch}%`;

  const exactMatchBoost = sql<number>`
    CASE
      WHEN coalesce(${tableAlias.lwin18}, '') ILIKE ${likeValue} THEN 1
      WHEN coalesce(${tableAlias.name}, '') ILIKE ${likeValue} THEN 0.2
      WHEN coalesce(${tableAlias.producer}, '') ILIKE ${likeValue} THEN 0.1
      ELSE 0
    END
  `;

  const tsRank = sql<number>`ts_rank(${searchVector}, ${tsQuery})`;

  const tokenScoreWeight = enforceTokenMatches ? 0.25 : 0.3;
  const tsRankWeight = enforceTokenMatches ? 0.65 : 0.55;
  const trigramWeight = enforceTokenMatches ? 0.25 : 0.35;

  const score = sql<number>`
    (${tsRank} * ${tsRankWeight}) +
    (${trigramSimilarity} * ${trigramWeight}) +
    ${exactMatchBoost} +
    (${tokenMatchRatio} * ${tokenScoreWeight})
  `;

  const baseFilter = sql`(${sql.join(matchConditions, sql` OR `)})`;

  const filter =
    enforceTokenMatches && tokenMatchCount
      ? sql`${baseFilter} AND ${tokenMatchCount} >= ${tokenMatchThreshold}`
      : baseFilter;

  return {
    filter,
    score,
  };
};

const productsGetMany = protectedProcedure
  .input(
    z.object({
      cursor: z.number().optional().default(0),
      limit: z.number().optional().default(50),
      search: z.string().optional(),
      productIds: z.array(z.uuid()).optional(),
      omitProductIds: z.array(z.uuid()).optional(),
      countries: z.array(z.string()).optional(),
      regions: z.array(z.string()).optional(),
      producers: z.array(z.string()).optional(),
      vintages: z.array(z.number()).optional(),
      sortBy: z
        .enum([
          'name-asc',
          'name-desc',
          'price-asc',
          'price-desc',
          'vintage-asc',
          'vintage-desc',
        ])
        .optional(),
    }),
  )
  .query(
    async ({
      input: {
        cursor,
        limit,
        search,
        productIds,
        omitProductIds,
        countries,
        regions,
        producers,
        vintages,
        sortBy,
      },
    }) => {
      const preparedSearch =
        search && search.trim().length > 0
          ? prepareSearch(search)
          : undefined;

      const whereConditions = {
        ...(productIds ? { id: { in: productIds } } : {}),
        ...(omitProductIds && omitProductIds.length > 0
          ? { id: { notIn: omitProductIds } }
          : {}),
        ...(countries && countries.length > 0
          ? { country: { in: countries } }
          : {}),
        ...(regions && regions.length > 0 ? { region: { in: regions } } : {}),
        ...(producers && producers.length > 0
          ? { producer: { in: producers } }
          : {}),
        ...(vintages && vintages.length > 0 ? { year: { in: vintages } } : {}),
        ...(preparedSearch
          ? {
              RAW: (table: typeof products) =>
                createSearchExpressions(table, preparedSearch).filter,
            }
          : {}),
      };

      const [productsResult, countResult] = await Promise.all([
        db.query.products.findMany({
          where: whereConditions,
          with: {
            productOffers: {
              orderBy: (productOffers, { asc, desc }) => [
                // Prioritize local_inventory (immediate dispatch) first
                desc(
                  sql`CASE WHEN ${productOffers.source} = 'local_inventory' THEN 1 ELSE 0 END`,
                ),
                // Then sort by price ascending
                asc(productOffers.price),
              ],
            },
          },
          limit: limit + 1,
          offset: cursor,
          orderBy: (table, { desc, asc }) => {
            // If search is active, prioritize search score
            if (preparedSearch) {
              const expressions = createSearchExpressions(table, preparedSearch);
              return [
                desc(expressions.score),
                asc(table.name),
                desc(table.year),
                desc(table.id),
              ];
            }

            // Subquery for minimum price from product_offers
            const minPrice = sql<number>`(
              SELECT MIN(${productOffers.price})
              FROM ${productOffers}
              WHERE ${productOffers.productId} = ${table.id}
            )`;

            // Handle sorting based on sortBy parameter
            switch (sortBy) {
              case 'name-desc':
                return [desc(table.name), desc(table.year), desc(table.id)];
              case 'vintage-asc':
                return [asc(table.year), asc(table.name), desc(table.id)];
              case 'vintage-desc':
                return [desc(table.year), asc(table.name), desc(table.id)];
              case 'price-asc':
                return [asc(minPrice), asc(table.name), desc(table.id)];
              case 'price-desc':
                return [desc(minPrice), asc(table.name), desc(table.id)];
              case 'name-asc':
              default:
                return [asc(table.name), desc(table.year), desc(table.id)];
            }
          },
        }),
        db.query.products.findMany({
          where: whereConditions,
          columns: {
            id: true,
          },
        }),
      ]);

      const nextCursor =
        productsResult.length > limit ? cursor + limit : undefined;

      return {
        data: productsResult.slice(0, limit),
        meta: {
          nextCursor,
          totalCount: countResult.length,
        },
      };
    },
  );

export type ProductsGetManyOutput = Awaited<ReturnType<typeof productsGetMany>>;

export type Product = ProductsGetManyOutput['data'][number];

export default productsGetMany;
