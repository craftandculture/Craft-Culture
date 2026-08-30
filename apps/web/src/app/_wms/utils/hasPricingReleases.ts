import { sql } from 'drizzle-orm';

import db from '@/database/client';
import logger from '@/utils/logger';

/** Cached for the life of the process; a table does not appear and vanish. */
let known: boolean | null = null;

/**
 * Make sure the per-owner release table is there, and say so
 *
 * Migrations run as `postbuild`, and that step exits quietly when DB_URL is
 * absent from the build environment. So a deploy can ship code that reads a
 * table the database has never been given — and a missing table in a WHERE
 * clause does not degrade, it fails the whole statement. The query then
 * retries, backs off and gives up, which reads as a slow screen ending in "No
 * products found" against wines that are sitting right there.
 *
 * Rather than wait on a build setting, the table is created on first use. The
 * DDL is the same guarded, additive statement the migration runs, so doing it
 * here is the same act at a different moment; and a feature that can repair
 * its own precondition beats one that needs someone to notice a log line.
 *
 * @returns Whether release data can be read and written
 */
const hasPricingReleases = async () => {
  if (known !== null) return known;

  try {
    const [row] = await db.execute<{ present: boolean }>(
      sql`SELECT to_regclass('public.wms_pricing_releases') IS NOT NULL AS present`,
    );

    if (row?.present) {
      known = true;

      return known;
    }

    logger.warn('[Pricing] wms_pricing_releases missing — creating it now');

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "wms_pricing_releases" (
        "lwin_key" text NOT NULL,
        "owner_id" uuid NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
        "released_at" timestamp NOT NULL DEFAULT now(),
        "released_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "wms_pricing_releases_key_owner_idx"
        ON "wms_pricing_releases" ("lwin_key", "owner_id")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "wms_pricing_releases_owner_idx"
        ON "wms_pricing_releases" ("owner_id")
    `);

    known = true;
  } catch (error) {
    // A filter is worth losing; the screen is not.
    known = false;
    logger.error('[Pricing] Could not prepare wms_pricing_releases', { error });
  }

  return known;
};

export default hasPricingReleases;
