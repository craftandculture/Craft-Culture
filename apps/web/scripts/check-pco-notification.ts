/* eslint-disable turbo/no-undeclared-env-vars */
/**
 * Debug script to check PCO notification requirements
 *
 * Run with: cd apps/web && npx tsx scripts/check-pco-notification.ts
 */

import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

const DB_URL = process.env.DB_URL || process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('DB_URL or DATABASE_URL environment variable required');
  process.exit(1);
}

const checkPCONotification = async () => {
  const sql = postgres(DB_URL!, { prepare: false });

  console.log('\n=== Checking PCO-2026-00009 Notification Requirements ===\n');

  // 1. Get the order with partner_id
  const orders = await sql`
    SELECT id, order_number, status, partner_id, submitted_at
    FROM private_client_orders
    WHERE order_number = 'PCO-2026-00009'
  `;

  if (orders.length === 0) {
    console.log('Order NOT FOUND!');
    await sql.end();
    return;
  }

  const order = orders[0];
  console.log('Order found:');
  console.log(`  - ID: ${order.id}`);
  console.log(`  - Order Number: ${order.order_number}`);
  console.log(`  - Status: ${order.status}`);
  console.log(`  - Partner ID: ${order.partner_id || 'NULL - THIS IS THE PROBLEM!'}`);
  console.log(`  - Submitted At: ${order.submitted_at}`);

  if (!order.partner_id) {
    console.log('\n❌ ORDER HAS NO PARTNER_ID - Notifications will be skipped!');
    await sql.end();
    return;
  }

  // 2. Check partner details
  console.log('\n=== Partner Details ===\n');
  const partners = await sql`
    SELECT id, business_name, business_email
    FROM partners
    WHERE id = ${order.partner_id}
  `;

  if (partners.length === 0) {
    console.log('Partner NOT FOUND!');
  } else {
    console.log(`Partner: ${partners[0].business_name}`);
    console.log(`Business Email: ${partners[0].business_email}`);
  }

  // 3. Check partner members
  console.log('\n=== Partner Members ===\n');
  const members = await sql`
    SELECT pm.user_id, u.email, u.name
    FROM partner_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.partner_id = ${order.partner_id}
  `;

  if (members.length === 0) {
    console.log('NO PARTNER MEMBERS FOUND - No one to send emails to!');
  } else {
    console.log(`Found ${members.length} member(s):`);
    for (const m of members) {
      console.log(`  - ${m.email} (${m.name})`);
    }
  }

  // 4. Check recent activity logs for this order
  console.log('\n=== Recent Activity Logs ===\n');
  const logs = await sql`
    SELECT action, previous_status, new_status, notes, created_at
    FROM private_client_order_activity_logs
    WHERE order_id = ${order.id}
    ORDER BY created_at DESC
    LIMIT 10
  `;

  if (logs.length === 0) {
    console.log('No activity logs found');
  } else {
    for (const log of logs) {
      console.log(`  [${log.created_at}] ${log.action}: ${log.previous_status} → ${log.new_status}`);
      if (log.notes) console.log(`    Notes: ${log.notes}`);
    }
  }

  await sql.end();
};

checkPCONotification().catch(console.error);
