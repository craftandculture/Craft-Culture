import { sql } from 'drizzle-orm';
import z from 'zod';

import db from '@/database/client';
import { products } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

const createSearchExpressions = (table: typeof products, rawSearch: string) => {
  const trimmedSearch = rawSearch.trim();

  const searchVector = sql`
    setweight(to_tsvector('english', coalesce(${table.name}, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(${table.producer}, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(${table.lwin18}, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(${table.region}, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(${table.year}::text, '')), 'C')
  `;

  const tsQuery = sql`websearch_to_tsquery('english', ${trimmedSearch})`;

  const trigramSimilarity = sql<number>`
    greatest(
      similarity(coalesce(${table.name}, ''), ${trimmedSearch}),
      similarity(coalesce(${table.producer}, ''), ${trimmedSearch}),
      similarity(coalesce(${table.region}, ''), ${trimmedSearch}),
      similarity(coalesce(${table.lwin18}, ''), ${trimmedSearch})
    )
  `;

  const searchTokens = trimmedSearch.split(/\s+/).filter(Boolean);

  const tokenConditions = searchTokens.map((token) => {
    const partial = `%${token}%`;
    return sql`
      (
        coalesce(${table.name}, '') ILIKE ${partial} OR
        coalesce(${table.producer}, '') ILIKE ${partial} OR
        coalesce(${table.region}, '') ILIKE ${partial} OR
        coalesce(${table.lwin18}, '') ILIKE ${partial}
      )
    `;
  });

  const matchConditions = [
    sql`${searchVector} @@ ${tsQuery}`,
    sql`${trigramSimilarity} > 0.1`,
  ];

  if (tokenConditions.length > 0) {
    matchConditions.push(sql`${sql.join(tokenConditions, sql` AND `)}`);
  }

  const partialMatchScore =
    tokenConditions.length > 0
      ? sql`(${sql.join(
          tokenConditions.map(
            (condition) => sql`CASE WHEN ${condition} THEN 1 ELSE 0 END`,
          ),
          sql` + `,
        )}) * 0.05`
      : sql`0`;

  const likeValue = `%${trimmedSearch}%`;

  const exactMatchBoost = sql<number>`
    CASE
      WHEN coalesce(${table.name}, '') ILIKE ${likeValue} THEN 0.2
      WHEN coalesce(${table.producer}, '') ILIKE ${likeValue} THEN 0.1
      ELSE 0
    END
  `;

  const tsRank = sql<number>`ts_rank(${searchVector}, ${tsQuery})`;

  const score = sql<number>`
    (${tsRank} * 0.6) + (${trigramSimilarity} * 0.3) + ${exactMatchBoost} + ${partialMatchScore}
  `;

  const filter = sql`(${sql.join(matchConditions, sql` OR `)})`;

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
    }),
  )
  .query(
    async ({
      input: { cursor, limit, search, productIds, omitProductIds },
    }) => {
      const productsResult = await db.query.products.findMany({
        where: {
          ...(productIds ? { id: { in: productIds } } : {}),
          ...(omitProductIds && omitProductIds.length > 0
            ? { id: { notIn: omitProductIds } }
            : {}),
          ...(search && search.trim().length > 0
            ? {
                RAW: (table) => createSearchExpressions(table, search).filter,
              }
            : {}),
        },
        with: {
          productOffers: {
            orderBy: {
              price: 'asc',
            },
            limit: 1,
          },
        },
        limit: limit + 1,
        offset: cursor,
        orderBy: (table, { desc, asc }) => [
          ...(search && search.trim().length > 0
            ? [desc(createSearchExpressions(table, search).score)]
            : []),
          asc(table.name),
          desc(table.year),
          desc(table.id),
        ],
      });

      const nextCursor =
        productsResult.length > limit ? cursor + limit : undefined;

      return {
        data: productsResult.slice(0, limit),
        meta: {
          nextCursor,
        },
      };
    },
  );

export type ProductsGetManyOutput = Awaited<ReturnType<typeof productsGetMany>>;

export type Product = ProductsGetManyOutput['data'][number];

export default productsGetMany;
