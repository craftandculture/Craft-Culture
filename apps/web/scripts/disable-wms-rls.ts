import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

config({ path: '.env.local' });

const connectionString = process.env.DB_URL;
if (!connectionString) {
  console.error('DB_URL not found in .env.local');
  process.exit(1);
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

const disableRLS = async () => {
  console.log('Disabling RLS on WMS tables...\n');

  const tables = [
    'wms_locations',
    'wms_stock',
    'wms_stock_movements',
    'wms_case_labels',
    'wms_cycle_counts',
    'wms_repacks',
    'wms_pick_lists',
    'wms_pick_list_items',
    'wms_dispatch_batches',
    'wms_delivery_notes',
    'wms_dispatch_batch_orders',
    'wms_pallets',
    'wms_pallet_cases',
    'wms_storage_charges',
    'wms_partner_requests',
    'consignment_settlements',
    'consignment_settlement_items',
  ];

  for (const table of tables) {
    try {
      await db.execute(sql.raw(`ALTER TABLE IF EXISTS ${table} DISABLE ROW LEVEL SECURITY`));
      console.log(`✓ Disabled RLS on ${table}`);
    } catch (error) {
      console.error(`✗ Failed to disable RLS on ${table}:`, error);
    }
  }

  // Verify by checking the locations count
  const result = await db.execute(sql`SELECT COUNT(*) as count FROM wms_locations`);
  console.log(`\nVerification: wms_locations count = ${result[0]?.count ?? 'unknown'}`);
};

disableRLS()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
