/* eslint-disable turbo/no-undeclared-env-vars */
/**
 * Debug script to investigate notification associations
 *
 * Run with: cd apps/web && npx tsx scripts/debug-notifications.ts
 */

import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

const DB_URL = process.env.DB_URL || process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('DB_URL or DATABASE_URL environment variable required');
  process.exit(1);
}

const debugNotifications = async () => {
  const sql = postgres(DB_URL!, { prepare: false });

  const testEmail = 'kbradford81628@gmail.com';

  console.log(`\n=== Debugging notifications for ${testEmail} ===\n`);

  // 1. Find the user
  const users = await sql`
    SELECT id, email, name, created_at
    FROM users
    WHERE email = ${testEmail}
  `;

  if (users.length === 0) {
    console.log('User not found!');
    await sql.end();
    return;
  }

  const user = users[0];
  console.log('User found:');
  console.log(`  ID: ${user.id}`);
  console.log(`  Name: ${user.name}`);
  console.log(`  Created: ${user.created_at}\n`);

  // 2. Check partner memberships
  console.log('Partner memberships:');
  const memberships = await sql`
    SELECT pm.partner_id, pm.role, p.business_name, p.type
    FROM partner_members pm
    JOIN partners p ON p.id = pm.partner_id
    WHERE pm.user_id = ${user.id}
  `;

  if (memberships.length === 0) {
    console.log('  No partner memberships found\n');
  } else {
    for (const m of memberships) {
      console.log(`  - ${m.business_name} (${m.type}) - Role: ${m.role}`);
      console.log(`    Partner ID: ${m.partner_id}`);
    }
    console.log('');
  }

  // 3. Check notifications for this user
  console.log('Notifications for this user:');
  const notifications = await sql`
    SELECT id, type, title, message, entity_id, created_at
    FROM notifications
    WHERE user_id = ${user.id}
    ORDER BY created_at DESC
    LIMIT 10
  `;

  if (notifications.length === 0) {
    console.log('  No notifications found\n');
  } else {
    for (const n of notifications) {
      console.log(`  - [${n.created_at}] ${n.title}`);
      console.log(`    ${n.message}`);
      console.log(`    Entity ID: ${n.entity_id}\n`);
    }
  }

  // 4. Check order PCO-2026-00007
  console.log('Order PCO-2026-00007 details:');
  const orders = await sql`
    SELECT id, order_number, partner_id, distributor_id, status
    FROM private_client_orders
    WHERE order_number = 'PCO-2026-00007'
  `;

  if (orders.length === 0) {
    console.log('  Order not found\n');
  } else {
    const order = orders[0];
    console.log(`  Order ID: ${order.id}`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Partner ID: ${order.partner_id}`);
    console.log(`  Distributor ID: ${order.distributor_id}\n`);

    // Get partner and distributor names
    if (order.partner_id) {
      const partners = await sql`SELECT business_name FROM partners WHERE id = ${order.partner_id}`;
      console.log(`  Partner: ${partners[0]?.business_name}`);
    }
    if (order.distributor_id) {
      const distributors = await sql`SELECT business_name FROM partners WHERE id = ${order.distributor_id}`;
      console.log(`  Distributor: ${distributors[0]?.business_name}`);
    }
  }

  await sql.end();
};

debugNotifications().catch(console.error);
