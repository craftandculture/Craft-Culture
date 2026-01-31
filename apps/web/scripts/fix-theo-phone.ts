/**
 * Quick fix script to update Theo Valich's phone number on orders
 * Run with: pnpm tsx scripts/fix-theo-phone.ts
 */
import { ilike } from 'drizzle-orm';

import db from '../src/database/client';
import { privateClientContacts, privateClientOrders } from '../src/database/schema';

const CORRECT_PHONE = '+971 52 158 4528';

const main = async () => {
  console.log('Finding orders for Theo Valich...');

  // Update orders
  const updatedOrders = await db
    .update(privateClientOrders)
    .set({
      clientPhone: CORRECT_PHONE,
      updatedAt: new Date(),
    })
    .where(ilike(privateClientOrders.clientName, '%theo%valich%'))
    .returning({ id: privateClientOrders.id, clientName: privateClientOrders.clientName });

  console.log(`Updated ${updatedOrders.length} orders:`);
  updatedOrders.forEach((o) => console.log(`  - ${o.id}: ${o.clientName}`));

  // Also update the contact record
  const updatedContacts = await db
    .update(privateClientContacts)
    .set({
      phone: CORRECT_PHONE,
      updatedAt: new Date(),
    })
    .where(ilike(privateClientContacts.name, '%theo%valich%'))
    .returning({ id: privateClientContacts.id, name: privateClientContacts.name });

  console.log(`Updated ${updatedContacts.length} contacts:`);
  updatedContacts.forEach((c) => console.log(`  - ${c.id}: ${c.name}`));

  console.log('Done!');
  process.exit(0);
};

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
