/* eslint-disable turbo/no-undeclared-env-vars */
/**
 * Add finance_email column to partners table
 *
 * Run with: cd apps/web && npx tsx scripts/add-finance-email-to-partners.ts
 */

import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

const DB_URL = process.env.DB_URL || process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('DB_URL or DATABASE_URL environment variable required');
  process.exit(1);
}

const addFinanceEmailToPartners = async () => {
  const sql = postgres(DB_URL!, { prepare: false });

  console.log('Adding finance_email column to partners table...');

  // Check if column already exists
  const existingColumn = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'finance_email'
  `;

  if (existingColumn.length > 0) {
    console.log('Column finance_email already exists, skipping...');
  } else {
    // Add the column
    await sql`
      ALTER TABLE partners
      ADD COLUMN finance_email text
    `;
    console.log('Added finance_email column');
  }

  console.log('Migration complete!');
  await sql.end();
};

addFinanceEmailToPartners().catch(console.error);
