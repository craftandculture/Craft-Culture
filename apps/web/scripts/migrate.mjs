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

    // Logistics documents: Transit BOE and Re-Export BOE document types.
    console.log('🔄 Ensuring logistics_document_type has BOE values...');
    await client.unsafe(
      `ALTER TYPE "logistics_document_type" ADD VALUE IF NOT EXISTS 'transit_boe'`,
    );
    await client.unsafe(
      `ALTER TYPE "logistics_document_type" ADD VALUE IF NOT EXISTS 're_export_boe'`,
    );
    console.log('✅ logistics_document_type BOE values ready');

    // Pricing Manager: per-SKU FZ→mainland transfer fee ($/btl; null = $2.50 default).
    console.log('🔄 Ensuring wms_product_pricing.transfer_price_per_bottle column...');
    await client.unsafe(
      `ALTER TABLE "wms_product_pricing" ADD COLUMN IF NOT EXISTS "transfer_price_per_bottle" double precision`,
    );
    console.log('✅ wms_product_pricing.transfer_price_per_bottle ready');

    // Native per-shipment cost ledger (line-by-line invoice charges).
    console.log('🔄 Ensuring logistics_shipment_cost_lines table...');
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "logistics_shipment_cost_lines" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "shipment_id" uuid NOT NULL REFERENCES "logistics_shipments"("id") ON DELETE CASCADE,
        "category" text NOT NULL DEFAULT 'freight',
        "description" text,
        "amount" double precision NOT NULL,
        "currency" text NOT NULL DEFAULT 'USD',
        "fx_to_usd" double precision NOT NULL DEFAULT 1,
        "amount_usd" double precision NOT NULL,
        "invoice_ref" text,
        "invoice_date" timestamp,
        "vendor" text,
        "source_document" text,
        "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "logistics_shipment_cost_lines_shipment_id_idx" ON "logistics_shipment_cost_lines"("shipment_id")`,
    );
    console.log('✅ logistics_shipment_cost_lines ready');

    // Reverse Repack: mark a repack as undone so it can't be reversed twice.
    console.log('🔄 Ensuring wms_repacks.reversed_at / reversed_by columns...');
    await client.unsafe(
      `ALTER TABLE "wms_repacks" ADD COLUMN IF NOT EXISTS "reversed_at" timestamp`,
    );
    await client.unsafe(
      `ALTER TABLE "wms_repacks" ADD COLUMN IF NOT EXISTS "reversed_by" uuid`,
    );
    console.log('✅ wms_repacks reversal columns ready');

    // Stock Triangulation: reconcile owner stock across C&C and City Drinks.
    console.log('🔄 Ensuring stock triangulation tables...');

    const createEnum = async (name, values) => {
      const literals = values.map((value) => `'${value}'`).join(', ');
      await client.unsafe(`
        DO $$ BEGIN
          CREATE TYPE "${name}" AS ENUM (${literals});
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);
    };

    await createEnum('tri_import_kind', [
      'cc_opening',
      'cc_sales_to_cd',
      'cc_count',
      'cd_sales',
      'cd_count',
    ]);
    await createEnum('tri_import_status', ['draft', 'committed']);
    await createEnum('tri_period_status', ['open', 'locked']);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "tri_skus" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "w_code" text NOT NULL UNIQUE,
        "lwin18" text,
        "product_name" text NOT NULL,
        "producer" text,
        "vintage" integer,
        "bottle_size" text DEFAULT '750ml',
        "case_config" integer NOT NULL DEFAULT 6,
        "owner_name" text DEFAULT 'Crurated',
        "is_active" boolean NOT NULL DEFAULT true,
        "notes" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "tri_skus_lwin18_idx" ON "tri_skus"("lwin18")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "tri_skus_product_name_idx" ON "tri_skus"("product_name")`,
    );
    // Added after the table shipped: whether the Zoho item master has been put
    // right for this wine. Cannot be inferred, because a sales order line
    // keeps the SKU it was raised under and never picks up an item rename.
    await client.unsafe(
      `ALTER TABLE "tri_skus" ADD COLUMN IF NOT EXISTS "zoho_cleaned_at" timestamp`,
    );

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "tri_sku_aliases" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sku_id" uuid NOT NULL REFERENCES "tri_skus"("id") ON DELETE CASCADE,
        "source" text NOT NULL DEFAULT 'city_drinks',
        "alias_code" text NOT NULL,
        "normalized_code" text NOT NULL,
        "alias_name" text,
        "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "tri_sku_aliases_sku_id_idx" ON "tri_sku_aliases"("sku_id")`,
    );
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "tri_sku_aliases_source_code_unique" ON "tri_sku_aliases"("source", "normalized_code")`,
    );

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "tri_periods" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "label" text NOT NULL UNIQUE,
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "status" "tri_period_status" NOT NULL DEFAULT 'open',
        "notes" text,
        "locked_at" timestamp,
        "locked_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "tri_periods_period_end_idx" ON "tri_periods"("period_end")`,
    );

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "tri_imports" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "period_id" uuid REFERENCES "tri_periods"("id") ON DELETE SET NULL,
        "kind" "tri_import_kind" NOT NULL,
        "status" "tri_import_status" NOT NULL DEFAULT 'draft',
        "file_name" text,
        "source_ref" text,
        "alias_source" text NOT NULL DEFAULT 'city_drinks',
        "as_of_date" date NOT NULL,
        "row_count" integer NOT NULL DEFAULT 0,
        "mapped_row_count" integer NOT NULL DEFAULT 0,
        "total_bottles" double precision NOT NULL DEFAULT 0,
        "notes" text,
        "uploaded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "committed_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "tri_imports_period_id_idx" ON "tri_imports"("period_id")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "tri_imports_kind_idx" ON "tri_imports"("kind")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "tri_imports_as_of_date_idx" ON "tri_imports"("as_of_date")`,
    );

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "tri_import_lines" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "import_id" uuid NOT NULL REFERENCES "tri_imports"("id") ON DELETE CASCADE,
        "sku_id" uuid REFERENCES "tri_skus"("id") ON DELETE SET NULL,
        "raw_code" text,
        "normalized_code" text,
        "raw_description" text,
        "raw_vintage" text,
        "quantity" double precision NOT NULL DEFAULT 0,
        "unit" text NOT NULL DEFAULT 'bottle',
        "case_config" integer,
        "quantity_bottles" double precision NOT NULL DEFAULT 0,
        "unit_price" double precision,
        "currency" text,
        "doc_ref" text,
        "doc_date" date,
        "status" text NOT NULL DEFAULT 'unmapped',
        "raw" jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "tri_import_lines_import_id_idx" ON "tri_import_lines"("import_id")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "tri_import_lines_sku_id_idx" ON "tri_import_lines"("sku_id")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "tri_import_lines_normalized_code_idx" ON "tri_import_lines"("normalized_code")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "tri_import_lines_status_idx" ON "tri_import_lines"("status")`,
    );
    console.log('✅ stock triangulation tables ready');

    /* ── SALES QUOTES — team-built client offer pages served at /q/<slug> ── */
    await client.unsafe(`
      DO $$ BEGIN
        CREATE TYPE "sales_quote_status" AS ENUM ('draft', 'published', 'archived');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "sales_quotes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug" text NOT NULL,
        "status" "sales_quote_status" NOT NULL DEFAULT 'draft',
        "quote_ref" text NOT NULL,
        "client" text NOT NULL,
        "client_company" text,
        "contact_name" text,
        "contact_email" text,
        "eyebrow" text NOT NULL DEFAULT 'Indicative Quotation',
        "h1" text NOT NULL DEFAULT 'Fine Wine Quotation',
        "subtitle" text,
        "valid_until" date,
        "promo_until" date,
        "lines" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "options" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "total_bottles" integer NOT NULL DEFAULT 0,
        "total_usd" double precision NOT NULL DEFAULT 0,
        "published_at" timestamp,
        "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "sales_quotes_slug_idx" ON "sales_quotes"("slug")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "sales_quotes_status_idx" ON "sales_quotes"("status")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "sales_quotes_client_idx" ON "sales_quotes"("client")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "sales_quotes_created_by_idx" ON "sales_quotes"("created_by")`,
    );
    // RLS is disabled across this schema and the app connects via the pooled
    // endpoint, which does not reliably honour the owner's RLS bypass — leaving
    // it enabled here would silently block writes. See the pricing-manager notes.
    await client.unsafe(
      `ALTER TABLE "sales_quotes" DISABLE ROW LEVEL SECURITY`,
    );
    console.log('✅ sales_quotes table ready');

    // --- wms_stock_movements.quantity_bottles -----------------------------
    // A split-case pick moves bottles, not cases, so the ledger showed "0".
    await client.unsafe(
      `ALTER TABLE "wms_stock_movements" ADD COLUMN IF NOT EXISTS "quantity_bottles" integer`,
    );
    // Backfill the split-case picks already recorded — their bottle count only
    // ever survived in the note text ("... — 3 bottle(s) (split-case)").
    await client.unsafe(
      `UPDATE "wms_stock_movements"
         SET "quantity_bottles" = NULLIF(substring("notes" from '([0-9]+) bottle'), '')::int
       WHERE "quantity_bottles" IS NULL
         AND "notes" ~ '[0-9]+ bottle'`,
    );
    console.log('✅ wms_stock_movements.quantity_bottles ready');

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await client.end();
    process.exit(1);
  }
};

runMigrations();
