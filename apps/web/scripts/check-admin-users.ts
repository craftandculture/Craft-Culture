/* eslint-disable turbo/no-undeclared-env-vars */
/**
 * Debug script to check admin users and notifications
 *
 * Run with: cd apps/web && npx tsx scripts/check-admin-users.ts
 */

import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

const DB_URL = process.env.DB_URL || process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('DB_URL or DATABASE_URL environment variable required');
  process.exit(1);
}

const checkAdminUsers = async () => {
  const sql = postgres(DB_URL!, { prepare: false });

  console.log('\n=== Checking Admin Users ===\n');

  // 1. Find all admin users
  const admins = await sql`
    SELECT id, email, name, role
    FROM users
    WHERE role = 'admin'
  `;

  console.log('Admin users found:', admins.length);
  for (const admin of admins) {
    console.log(`  - ${admin.email} (${admin.name}) - role: ${admin.role}`);
  }

  // 2. Check kevin@craftculture.xyz specifically
  console.log('\n=== Checking kevin@craftculture.xyz ===\n');
  const kevin = await sql`
    SELECT id, email, name, role
    FROM users
    WHERE email = 'kevin@craftculture.xyz'
  `;

  if (kevin.length > 0) {
    console.log('Found:', kevin[0]);
  } else {
    console.log('NOT FOUND!');
  }

  // 3. Check recent notifications for PCO
  console.log('\n=== Recent PCO Notifications ===\n');
  const notifications = await sql`
    SELECT id, user_id, type, title, message, created_at
    FROM notifications
    WHERE type = 'po_submitted'
    ORDER BY created_at DESC
    LIMIT 5
  `;

  if (notifications.length === 0) {
    console.log('No PCO submission notifications found');
  } else {
    for (const n of notifications) {
      console.log(`  - [${n.created_at}] ${n.title}`);
      console.log(`    ${n.message}`);
      console.log(`    User ID: ${n.user_id}\n`);
    }
  }

  // 4. Check order PCO-2026-00009
  console.log('\n=== Order PCO-2026-00009 ===\n');
  const orders = await sql`
    SELECT id, order_number, status, submitted_at
    FROM private_client_orders
    WHERE order_number = 'PCO-2026-00009'
  `;

  if (orders.length > 0) {
    console.log('Order found:', orders[0]);
  }

  await sql.end();
};

checkAdminUsers().catch(console.error);
