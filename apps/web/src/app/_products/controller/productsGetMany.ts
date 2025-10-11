import { sql } from 'drizzle-orm';
import z from 'zod';

import db from '@/database/client';
import { protectedProcedure } from '@/lib/trpc/procedures';

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
          ...(search
            ? {
                RAW: (table) => sql`
          (
            -- Full-text search for complete words
            to_tsvector('english',
              coalesce(${table.name}, '') || ' ' ||
              coalesce(${table.producer}, '') || ' ' ||
              coalesce(${table.lwin18}, '') || ' ' ||
              coalesce(${table.region}, '') || ' ' ||
              coalesce(${table.year}::text, '')) @@ plainto_tsquery('english', ${search})
            OR
            -- Trigram similarity for partial matches
            similarity(coalesce(${table.name}, ''), ${search}) > 0.1
            OR
            similarity(coalesce(${table.producer}, ''), ${search}) > 0.1
            OR
            similarity(coalesce(${table.region}, ''), ${search}) > 0.1
            OR
            similarity(coalesce(${table.lwin18}, ''), ${search}) > 0.1
            OR
            -- Case-insensitive LIKE for simple substring matching
            ${table.name} ILIKE ${'%' + search + '%'}
            OR
            ${table.producer} ILIKE ${'%' + search + '%'}
            OR
            ${table.region} ILIKE ${'%' + search + '%'}
            OR
              ${table.lwin18} ILIKE ${'%' + search + '%'}
            )
          `,
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
        orderBy: {
          name: 'asc',
          year: 'desc',
          id: 'desc',
        },
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
