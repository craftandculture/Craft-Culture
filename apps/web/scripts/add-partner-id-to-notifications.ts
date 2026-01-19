/* eslint-disable turbo/no-undeclared-env-vars */
/**
 * Add partner_id column to notifications table
 *
 * Run with: cd apps/web && npx tsx scripts/add-partner-id-to-notifications.ts
 */

import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

const DB_URL = process.env.DB_URL || process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('DB_URL or DATABASE_URL environment variable required');
  process.exit(1);
}

const addPartnerIdToNotifications = async () => {
  const sql = postgres(DB_URL!, { prepare: false });

  console.log('Adding partner_id column to notifications table...');

  // Check if column already exists
  const existingColumn = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'partner_id'
  `;

  if (existingColumn.length > 0) {
    console.log('Column partner_id already exists, skipping...');
  } else {
    // Add the column
    await sql`
      ALTER TABLE notifications
      ADD COLUMN partner_id uuid
      REFERENCES partners(id) ON DELETE CASCADE
    `;
    console.log('Added partner_id column');
  }

  // Check if index already exists
  const existingIndex = await sql`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'notifications' AND indexname = 'notifications_partner_id_idx'
  `;

  if (existingIndex.length > 0) {
    console.log('Index notifications_partner_id_idx already exists, skipping...');
  } else {
    // Create index
    await sql`
      CREATE INDEX notifications_partner_id_idx ON notifications(partner_id)
    `;
    console.log('Created index notifications_partner_id_idx');
  }

  console.log('Migration complete!');
  await sql.end();
};

addPartnerIdToNotifications().catch(console.error);
