import { and, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { lwinWines } from '@/database/schema';

/**
 * The five LWIN register records most like an inbound line, best first
 *
 * Trigram similarity on the display name and on producer plus wine, ranked in
 * the database: 208k records per line, and only the top few ever matter.
 *
 * @param searchName - The line's wine name, vintage, size and strength stripped
 * @param withProducer - The same with the producer in front, when the invoice gave one
 * @param hasProducer - Whether a producer was added, which discounts the name-only score
 * @returns Up to five records with their score, from 0 to 1
 */
const searchRegister = async (searchName: string, withProducer: string, hasProducer: boolean) =>
  db
        .select({
          lwin: lwinWines.lwin,
          displayName: lwinWines.displayName,
          producerTitle: lwinWines.producerTitle,
          producerName: lwinWines.producerName,
          wine: lwinWines.wine,
          region: lwinWines.region,
          subRegion: lwinWines.subRegion,
          country: lwinWines.country,
          classification: lwinWines.classification,
          score: sql<number>`GREATEST(
            similarity(${lwinWines.displayName}, ${withProducer}),
            similarity(
              (COALESCE(${lwinWines.producerTitle}, '') || ' ' || COALESCE(${lwinWines.producerName}, '') || ' ' || COALESCE(${lwinWines.wine}, '')),
              ${withProducer}
            ),
            similarity(${lwinWines.displayName}, ${searchName}) * ${hasProducer ? 0.85 : 1}
          )`.as('score'),
        })
        .from(lwinWines)
        .where(
          and(
            eq(lwinWines.status, 'live'),
            /*
              Narrowed by the trigram index on display_name alone.

              The second half of this used to be `producer || ' ' || wine %
              $1`, which is two bugs in one line. Postgres binds `%` tighter
              than `||`, so it read as `producer || ' ' || (wine % $1)` — a
              text value handed to OR, which is the error it raised. And the
              expression has no index, so every line would have scanned all
              208k records to find out.

              Producer and wine are still scored, above; they just no longer
              decide which rows are looked at.
            */
            sql`(${lwinWines.displayName} % ${withProducer} OR ${lwinWines.displayName} % ${searchName})`,
          ),
        )
        .orderBy(sql`score DESC`)
        .limit(5);

export default searchRegister;
