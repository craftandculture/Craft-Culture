/* eslint-disable */
// Load env FIRST before any imports
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { wmsLocations, wmsPickListItems, wmsPickLists } from '../src/database/schema';

const client = postgres(process.env.DB_URL || '', { prepare: false });
const db = drizzle(client);

async function main() {
  // Get the most recent pick list
  const [pickList] = await db
    .select()
    .from(wmsPickLists)
    .orderBy(desc(wmsPickLists.createdAt))
    .limit(1);

  if (!pickList) {
    console.log('No pick lists found');
    process.exit(0);
  }

  console.log('=== PICK LIST:', pickList.pickListNumber, '===');
  console.log('Order:', pickList.orderNumber);
  console.log('');

  // Get pick list items with locations
  const items = await db
    .select({
      productName: wmsPickListItems.productName,
      lwin18: wmsPickListItems.lwin18,
      quantityCases: wmsPickListItems.quantityCases,
      locationId: wmsPickListItems.suggestedLocationId,
      locationCode: wmsLocations.locationCode,
      locationBarcode: wmsLocations.barcode,
    })
    .from(wmsPickListItems)
    .leftJoin(wmsLocations, eq(wmsLocations.id, wmsPickListItems.suggestedLocationId))
    .where(eq(wmsPickListItems.pickListId, pickList.id));

  console.log('=== BARCODES FOR TESTING ===');
  console.log('');

  for (const item of items) {
    console.log('Product:', item.productName);
    console.log('  Qty:', item.quantityCases, 'cases');
    console.log('  CASE BARCODE (LWIN):', item.lwin18 || 'NO LWIN');
    console.log('  BAY:', item.locationCode || 'NO LOCATION');
    console.log('  BAY BARCODE:', item.locationBarcode || 'NO BARCODE');
    console.log('');
  }

  await client.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
