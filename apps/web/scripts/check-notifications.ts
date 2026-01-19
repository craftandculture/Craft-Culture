/* eslint-disable turbo/no-undeclared-env-vars */
/**
 * Check in-app notifications for a PCO order
 *
 * Run with: cd apps/web && npx tsx scripts/check-notifications.ts
 */

import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

const DB_URL = process.env.DB_URL || process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('DB_URL or DATABASE_URL environment variable required');
  process.exit(1);
}

const checkNotifications = async () => {
  const sql = postgres(DB_URL, { prepare: false });

  const orderId = 'ba844eb1-096d-40ce-aaa3-d1d5b061e80f';

  console.log('\n=== In-App Notifications for PCO-2026-00009 ===\n');

  // Check for in-app notifications related to this order
  const notifications = await sql`
    SELECT id, user_id, title, message, type, entity_type, entity_id, created_at
    FROM notifications
    WHERE entity_id = ${orderId}
    ORDER BY created_at DESC
    LIMIT 10
  `;

  if (notifications.length === 0) {
    console.log('NO IN-APP NOTIFICATIONS FOUND!');
    console.log('This means notifyPartnerOfOrderUpdate is NOT being called or failing before creating notifications.');
  } else {
    console.log(`Found ${notifications.length} notification(s):`);
    for (const n of notifications) {
      console.log(`  [${n.created_at}] ${n.type}: ${n.title}`);
      console.log(`    Message: ${n.message}`);
      console.log(`    User ID: ${n.user_id}`);
    }
  }

  // Also check for ANY recent notifications to see if system is working
  console.log('\n=== Recent Notifications (any order) ===\n');
  const recentNotifications = await sql`
    SELECT id, user_id, title, message, type, entity_type, created_at
    FROM notifications
    WHERE entity_type = 'private_client_order'
    ORDER BY created_at DESC
    LIMIT 5
  `;

  if (recentNotifications.length === 0) {
    console.log('No PCO notifications found at all.');
  } else {
    console.log(`Found ${recentNotifications.length} recent PCO notification(s):`);
    for (const n of recentNotifications) {
      console.log(`  [${n.created_at}] ${n.type}: ${n.title}`);
    }
  }

  await sql.end();
};

checkNotifications().catch(console.error);
