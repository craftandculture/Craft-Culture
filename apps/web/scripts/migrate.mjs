#!/usr/bin/env node
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));

const runMigrations = async () => {
  const dbUrl = process.env.DB_URL;

  if (!dbUrl) {
    console.log('⚠️ DB_URL not available, skipping migrations (this is expected during build)');
    process.exit(0);
  }

  const client = postgres(dbUrl, { max: 1 });

  try {
    // Check if source_customer_pos table exists
    const tableCheck = await client`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'source_customer_pos'
      ) as exists
    `;

    if (!tableCheck[0].exists) {
      console.log('🔄 Running SOURCE module migration (0015_parched_winter_soldier.sql)...');

      // Read and execute the migration file
      const migrationPath = join(__dirname, '../src/database/0015_parched_winter_soldier.sql');
      const migrationSql = readFileSync(migrationPath, 'utf-8');

      // Split by statement breakpoint and execute each statement
      const statements = migrationSql.split('--> statement-breakpoint');

      for (const statement of statements) {
        const trimmed = statement.trim();
        if (trimmed) {
          try {
            await client.unsafe(trimmed);
          } catch (err) {
            // Ignore "already exists" errors for enums and tables
            if (!err.message.includes('already exists') && !err.message.includes('duplicate key')) {
              throw err;
            }
            console.log(`  ⏭️ Skipped (already exists): ${trimmed.substring(0, 50)}...`);
          }
        }
      }

      console.log('✅ SOURCE module tables created successfully');
    } else {
      console.log('✅ SOURCE module tables already exist');
    }

    // Check if logistics_shipments table exists
    const logisticsCheck = await client`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'logistics_shipments'
      ) as exists
    `;

    if (!logisticsCheck[0].exists) {
      console.log('🔄 Running LOGISTICS module migration (0016_mysterious_silhouette.sql)...');

      const logisticsMigrationPath = join(__dirname, '../src/database/0016_mysterious_silhouette.sql');
      const logisticsMigrationSql = readFileSync(logisticsMigrationPath, 'utf-8');

      const logisticsStatements = logisticsMigrationSql.split('--> statement-breakpoint');

      for (const statement of logisticsStatements) {
        const trimmed = statement.trim();
        if (trimmed) {
          try {
            await client.unsafe(trimmed);
          } catch (err) {
            // Ignore "already exists" errors for enums and tables
            if (!err.message.includes('already exists') && !err.message.includes('duplicate key')) {
              throw err;
            }
            console.log(`  ⏭️ Skipped (already exists): ${trimmed.substring(0, 50)}...`);
          }
        }
      }

      console.log('✅ LOGISTICS module tables created successfully');
    } else {
      console.log('✅ LOGISTICS module tables already exist');
    }

    // Create zoho_invoices table if it doesn't exist
    const zohoInvoicesCheck = await client`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'zoho_invoices'
      ) as exists
    `;

    if (!zohoInvoicesCheck[0].exists) {
      console.log('🔄 Creating zoho_invoices table...');
      await client.unsafe(`
        CREATE TABLE IF NOT EXISTS "zoho_invoices" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "zoho_invoice_id" text NOT NULL UNIQUE,
          "invoice_number" text NOT NULL,
          "zoho_customer_id" text NOT NULL,
          "customer_name" text NOT NULL,
          "status" text NOT NULL,
          "invoice_date" date NOT NULL,
          "due_date" date,
          "reference_number" text,
          "sub_total" double precision NOT NULL,
          "total" double precision NOT NULL,
          "balance" double precision NOT NULL DEFAULT 0,
          "currency_code" text DEFAULT 'USD',
          "last_sync_at" timestamp,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "zoho_invoices_zoho_id_idx" ON "zoho_invoices" ("zoho_invoice_id");
        CREATE INDEX IF NOT EXISTS "zoho_invoices_date_idx" ON "zoho_invoices" ("invoice_date");
        CREATE INDEX IF NOT EXISTS "zoho_invoices_status_idx" ON "zoho_invoices" ("status");
      `);
      console.log('✅ zoho_invoices table created');
    } else {
      console.log('✅ zoho_invoices table already exists');
    }

    // Legacy migration: Add local_inventory enum value if needed
    const enumCheck = await client`
      SELECT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'local_inventory'
        AND enumtypid = (
          SELECT oid FROM pg_type WHERE typname = 'product_source'
        )
      ) as exists
    `;

    if (!enumCheck[0].exists) {
      console.log('🔄 Adding local_inventory to product_source enum...');
      await client.unsafe(`ALTER TYPE "public"."product_source" ADD VALUE 'local_inventory'`);
      console.log('✅ Added local_inventory enum value');
    }

    // Split-case picking: per-case open-bottle tracking.
    // NULL = sealed/full case; a number = opened case with that many bottles left.
    console.log('🔄 Ensuring wms_case_labels.open_bottles column...');
    await client.unsafe(
      `ALTER TABLE "wms_case_labels" ADD COLUMN IF NOT EXISTS "open_bottles" integer`,
    );
    console.log('✅ wms_case_labels.open_bottles ready');

    // Split-case picking: bottle-level pick quantity on pick lines.
    // NULL = whole-case pick; a number = pick that many loose bottles.
    console.log('🔄 Ensuring wms_pick_list_items.quantity_bottles column...');
    await client.unsafe(
      `ALTER TABLE "wms_pick_list_items" ADD COLUMN IF NOT EXISTS "quantity_bottles" integer`,
    );
    console.log('✅ wms_pick_list_items.quantity_bottles ready');

    // Split-case picking: authoritative loose-bottle count on the stock row.
    console.log('🔄 Ensuring wms_stock.open_bottles column...');
    await client.unsafe(
      `ALTER TABLE "wms_stock" ADD COLUMN IF NOT EXISTS "open_bottles" integer NOT NULL DEFAULT 0`,
    );
    console.log('✅ wms_stock.open_bottles ready');

    // Pricing Manager: bespoke per-line margin % over landed (Spirits/RTD).
    console.log('🔄 Ensuring wms_product_pricing.sell_margin_pct column...');
    await client.unsafe(
      `ALTER TABLE "wms_product_pricing" ADD COLUMN IF NOT EXISTS "sell_margin_pct" double precision`,
    );
    console.log('✅ wms_product_pricing.sell_margin_pct ready');

    // Pricing Manager: per-line logistics $/btl override.
    console.log('🔄 Ensuring wms_product_pricing.logistics_per_bottle column...');
    await client.unsafe(
      `ALTER TABLE "wms_product_pricing" ADD COLUMN IF NOT EXISTS "logistics_per_bottle" double precision`,
    );
    console.log('✅ wms_product_pricing.logistics_per_bottle ready');

    // Logistics cost ledger: supplier/vendor per invoice line.
    console.log('🔄 Ensuring logistics_group_cost_lines.vendor column...');
    await client.unsafe(
      `ALTER TABLE "logistics_group_cost_lines" ADD COLUMN IF NOT EXISTS "vendor" text`,
    );
    console.log('✅ logistics_group_cost_lines.vendor ready');

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await client.end();
    process.exit(1);
  }
};

runMigrations();
