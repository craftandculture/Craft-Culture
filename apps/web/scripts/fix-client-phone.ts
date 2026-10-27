/**
 * Correct a private client's phone number on their orders and contact record
 *
 * Run with:
 *   pnpm tsx scripts/fix-client-phone.ts "<client name>" "<phone>"
 *
 * The name is matched case-insensitively and loosely (spaces become
 * wildcards), so check the printed list of updated rows.
 */
import { ilike } from 'drizzle-orm';

import db from '../src/database/client';
import { privateClientContacts, privateClientOrders } from '../src/database/schema';

const [clientName, correctPhone] = process.argv.slice(2);

if (!clientName?.trim() || !correctPhone?.trim()) {
  console.error('Usage: pnpm tsx scripts/fix-client-phone.ts "<client name>" "<phone>"');
  process.exit(1);
}

const namePattern = `%${clientName.trim().split(/\s+/).join('%')}%`;

const main = async () => {
  console.log(`Finding orders for clients matching "${clientName}"...`);

  // Update orders
  const updatedOrders = await db
    .update(privateClientOrders)
    .set({
      clientPhone: correctPhone.trim(),
      updatedAt: new Date(),
    })
    .where(ilike(privateClientOrders.clientName, namePattern))
    .returning({ id: privateClientOrders.id, clientName: privateClientOrders.clientName });

  console.log(`Updated ${updatedOrders.length} orders:`);
  updatedOrders.forEach((o) => console.log(`  - ${o.id}: ${o.clientName}`));

  // Also update the contact record
  const updatedContacts = await db
    .update(privateClientContacts)
    .set({
      phone: correctPhone.trim(),
      updatedAt: new Date(),
    })
    .where(ilike(privateClientContacts.name, namePattern))
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
