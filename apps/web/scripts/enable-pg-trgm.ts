/* eslint-disable turbo/no-undeclared-env-vars */
/**
 * Enable pg_trgm extension and create trigram index for fuzzy text matching
 *
 * Run with: DB_URL="..." node_modules/.bin/tsx scripts/enable-pg-trgm.ts
 */

import postgres from 'postgres';

const DB_URL = process.env.DB_URL || process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('DB_URL or DATABASE_URL environment variable required');
  process.exit(1);
}

const enablePgTrgm = async () => {
  const sql = postgres(DB_URL!, { prepare: false });

  console.log('Enabling pg_trgm extension...');
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
  console.log('pg_trgm extension enabled!');

  console.log('Creating trigram index on lwin_wines.display_name...');
  await sql`CREATE INDEX IF NOT EXISTS lwin_wines_display_name_trgm_idx ON lwin_wines USING gin (display_name gin_trgm_ops)`;
  console.log('Trigram index created!');

  await sql.end();
};

enablePgTrgm().catch(console.error);
