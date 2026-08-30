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

  /** Data backfills that failed, reported together at the end. */
  const dataFixFailures = [];

  /**
   * Run a one-off DATA backfill without letting it block the deploy.
   *
   * This script runs as `postbuild`, so anything that throws here exits 1 and
   * fails the whole Vercel deployment — a historical data patch once wedged the
   * pipeline for hours, holding back every unrelated fix behind it. Schema DDL
   * stays fatal (the app's code expects those columns to exist), but a backfill
   * correcting past rows is not something the new build depends on: log it
   * loudly, keep going, and fix it in a follow-up.
   *
   * @param label - What the backfill does, for the log
   * @param run - Async thunk performing the work
   */
  const dataFix = async (label, run) => {
    try {
      await run();
      console.log(`✅ ${label}`);
    } catch (error) {
      dataFixFailures.push(label);
      console.error(`⚠️  DATA BACKFILL FAILED (deploy continues): ${label}`);
      console.error(error);
    }
  };

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

    // --- loose bottles become real single-bottle stock ---------------------
    // open_bottles was a counter nothing else read: stock is modelled in CASES,
    // so bottles left by a cracked case had no case count, vanished from the
    // stock explorer, could not be matched to an order line and counted as zero
    // in every bottle total. Singles are recorded the way the warehouse already
    // records them — a row whose pack is 1. Quantity-preserving and idempotent:
    // each source row is zeroed as it is converted.
    await dataFix('loose bottles converted to single-bottle stock', () =>
      client.unsafe(`
      DO $$
      DECLARE r RECORD;
              singles_lwin text;
              singles_id uuid;
      BEGIN
        FOR r IN
          SELECT * FROM wms_stock
          WHERE COALESCE(open_bottles, 0) > 0
            AND array_length(string_to_array(lwin18, '-'), 1) = 4
        LOOP
          singles_lwin := split_part(r.lwin18, '-', 1) || '-'
                       || split_part(r.lwin18, '-', 2) || '-01-'
                       || split_part(r.lwin18, '-', 4);

          IF singles_lwin = r.lwin18 THEN
            UPDATE wms_stock
               SET quantity_cases = quantity_cases + r.open_bottles,
                   available_cases = available_cases + r.open_bottles,
                   open_bottles = 0,
                   updated_at = now()
             WHERE id = r.id;
            CONTINUE;
          END IF;

          SELECT id INTO singles_id FROM wms_stock
           WHERE location_id = r.location_id
             AND lwin18 = singles_lwin
             AND owner_id = r.owner_id
             AND lot_number IS NOT DISTINCT FROM r.lot_number
           LIMIT 1;

          IF singles_id IS NULL THEN
            INSERT INTO wms_stock (
              location_id, owner_id, owner_name, lwin18, product_name, producer,
              vintage, bottle_size, case_config, quantity_cases, reserved_cases,
              available_cases, open_bottles, lot_number, received_at, shipment_id,
              sales_arrangement, consignment_commission_percent, category,
              expiry_date, is_perishable, re_export_boe_number
            ) VALUES (
              r.location_id, r.owner_id, r.owner_name, singles_lwin,
              regexp_replace(r.product_name, ' \\(\\d+x\\)$', '') || ' (1x)',
              r.producer, r.vintage, r.bottle_size, 1, r.open_bottles, 0,
              r.open_bottles, 0, r.lot_number, r.received_at, r.shipment_id,
              r.sales_arrangement, r.consignment_commission_percent, r.category,
              r.expiry_date, r.is_perishable, r.re_export_boe_number
            );
          ELSE
            UPDATE wms_stock
               SET quantity_cases = quantity_cases + r.open_bottles,
                   available_cases = available_cases + r.open_bottles,
                   updated_at = now()
             WHERE id = singles_id;
          END IF;

          UPDATE wms_stock SET open_bottles = 0, updated_at = now() WHERE id = r.id;
        END LOOP;
      END $$;
    `),
    );

    // --- ledger entries for the converted loose bottles ---------------------
    // The conversion above moved bottles into single-bottle rows without
    // recording a movement, so the reconciliation reads them as stock that
    // never arrived — and its "Fix Now" DELETES stock with no receive or
    // repack_in movement. Those bottles are real; the arrival just needs
    // writing down. Idempotent via the reason_code check.
    await dataFix('ledger entries written for converted single bottles', () =>
      client.unsafe(`
      INSERT INTO wms_stock_movements (
        movement_number, movement_type, lwin18, product_name, quantity_cases,
        quantity_bottles, to_location_id, notes, reason_code, performed_by, performed_at
      )
      SELECT
        'MOV-SPLITFIX-' || left(md5(s.lwin18), 10),
        'repack_in',
        s.lwin18,
        s.product_name,
        s.shortfall,
        s.shortfall,
        s.location_id,
        'Bottles from a cracked case, recorded when single bottles became stock rows',
        'split_case_backfill',
        (SELECT performed_by FROM wms_stock_movements ORDER BY performed_at DESC LIMIT 1),
        now()
      FROM (
        SELECT st.lwin18,
               MAX(st.product_name) AS product_name,
               MIN(st.location_id)  AS location_id,
               SUM(st.quantity_cases) - COALESCE(MAX(led.expected), 0) AS shortfall
          FROM wms_stock st
          LEFT JOIN (
            SELECT lwin18, SUM(CASE movement_type
              WHEN 'receive' THEN quantity_cases WHEN 'count' THEN quantity_cases
              WHEN 'repack_in' THEN quantity_cases
              WHEN 'adjust' THEN CASE WHEN reason_code IS DISTINCT FROM 'stock_correction' THEN quantity_cases ELSE 0 END
              WHEN 'pick' THEN -quantity_cases WHEN 'repack_out' THEN -quantity_cases
              ELSE 0 END) AS expected
              FROM wms_stock_movements GROUP BY lwin18
          ) led ON led.lwin18 = st.lwin18
         WHERE st.case_config = 1
           -- only where the wine also exists in a bigger pack, i.e. a case was cracked
           AND EXISTS (
             SELECT 1 FROM wms_stock c
              WHERE split_part(c.lwin18, '-', 1) = split_part(st.lwin18, '-', 1)
                AND split_part(c.lwin18, '-', 2) = split_part(st.lwin18, '-', 2)
                AND split_part(c.lwin18, '-', 4) = split_part(st.lwin18, '-', 4)
                AND c.case_config > 1
           )
         GROUP BY st.lwin18
      ) s
      WHERE s.shortfall > 0
        AND NOT EXISTS (
          SELECT 1 FROM wms_stock_movements m
           WHERE m.lwin18 = s.lwin18 AND m.reason_code = 'split_case_backfill'
        );
    `),
    );

    // --- triangulation becomes multi-client ---------------------------------
    // The tool was built for Crurated alone, with the parties baked in: W codes
    // globally unique, one period calendar for everyone, and the WMS owner and
    // Zoho customer names living in browser localStorage. None of that admits a
    // second client. This adds the tenancy key and moves the three uniqueness
    // rules inside it, without changing a single figure — every existing row is
    // Crurated's, and the column default keeps the untouched controllers
    // inserting valid rows while the rest of the work lands around them.
    const CRURATED_PROGRAMME_ID = '11111111-1111-1111-1111-111111111111';

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "tri_programmes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "slug" text NOT NULL UNIQUE,
        "consignor_id" uuid REFERENCES "partners"("id") ON DELETE SET NULL,
        "custodian_id" uuid REFERENCES "partners"("id") ON DELETE SET NULL,
        "outlet_id" uuid REFERENCES "partners"("id") ON DELETE SET NULL,
        "wms_owner_match" text,
        "zoho_customer_match" text,
        "identity_strategy" text NOT NULL DEFAULT 'lwin',
        "is_active" boolean NOT NULL DEFAULT true,
        "notes" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "tri_programmes_consignor_id_idx" ON "tri_programmes"("consignor_id")`,
    );

    // Seeded before the columns that default to it, and with the same match
    // values the browser was holding, so the live figures are unchanged.
    await client.unsafe(`
      INSERT INTO "tri_programmes"
        ("id", "name", "slug", "wms_owner_match", "zoho_customer_match", "identity_strategy", "notes")
      VALUES (
        '${CRURATED_PROGRAMME_ID}', 'Crurated', 'crurated', 'CRURATED', 'CD General', 'w_code',
        'Crurated stock in the C&C warehouse, sold through City Drinks. The programme the tool was originally built for.'
      )
      ON CONFLICT ("id") DO NOTHING
    `);

    // ADD COLUMN with a DEFAULT backfills existing rows in one pass, so the
    // NOT NULL below is safe without a separate UPDATE.
    for (const table of ['tri_skus', 'tri_sku_aliases', 'tri_periods', 'tri_imports']) {
      await client.unsafe(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "programme_id" uuid
           NOT NULL DEFAULT '${CRURATED_PROGRAMME_ID}'
           REFERENCES "tri_programmes"("id") ON DELETE CASCADE`,
      );
      await client.unsafe(
        `CREATE INDEX IF NOT EXISTS "${table}_programme_id_idx" ON "${table}"("programme_id")`,
      );
    }

    // New scoped rules first: they must build cleanly against the current data
    // before the old ones are given up. On single-tenant data they are the same
    // rule, so this is a no-op that proves itself.
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "tri_skus_programme_w_code_unique" ON "tri_skus"("programme_id", "w_code")`,
    );
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "tri_sku_aliases_programme_source_code_unique" ON "tri_sku_aliases"("programme_id", "source", "normalized_code")`,
    );
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "tri_periods_programme_label_unique" ON "tri_periods"("programme_id", "label")`,
    );

    // Only now drop the global ones, which would otherwise stop Cru Wine using
    // a code Crurated already use, or a second client opening "2026-08".
    await client.unsafe(
      `ALTER TABLE "tri_skus" DROP CONSTRAINT IF EXISTS "tri_skus_w_code_key"`,
    );
    await client.unsafe(
      `ALTER TABLE "tri_periods" DROP CONSTRAINT IF EXISTS "tri_periods_label_key"`,
    );
    await client.unsafe(
      `DROP INDEX IF EXISTS "tri_sku_aliases_source_code_unique"`,
    );
    console.log('✅ tri_* multi-client tenancy ready');

    // --- LWIN-first identity -----------------------------------------------
    // Only Crurated issue W codes. Requiring one meant a client without them
    // could not have a SKU at all, so the column becomes optional and the
    // scoped unique index treats the resulting NULLs as distinct. Nothing is
    // lost for Crurated: their codes stay, and stay unique within a programme.
    await client.unsafe(
      `ALTER TABLE "tri_skus" ALTER COLUMN "w_code" DROP NOT NULL`,
    );
    // The identity a `lwin` programme is looked up by. Not unique on purpose —
    // Crurated already hold duplicate-LWIN pairs, and an index that fails to
    // build is a failed deploy.
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "tri_skus_programme_lwin18_idx" ON "tri_skus"("programme_id", "lwin18")`,
    );

    // Cru Wine, ready to receive its first inputs. Seeded rather than created
    // through the UI so the onboarding steps that follow have something real
    // to point at, and so the second programme exists before anyone relies on
    // there only ever being one.
    await client.unsafe(`
      INSERT INTO "tri_programmes"
        ("name", "slug", "identity_strategy", "notes")
      VALUES (
        'Cru Wine', 'cru-wine', 'lwin',
        'Consignment programme for Cru Wine. Identified by LWIN — no W codes. Needs its WMS owner and Zoho customer strings set before the live feeds will find anything.'
      )
      ON CONFLICT ("slug") DO NOTHING
    `);
    // The clients to test against, seeded rather than added by hand so they
    // exist before anyone needs them. C&C is one of them: we consign our own
    // stock too, and a programme where C&C is the consignor is the same five
    // inputs with a different party in the first column, not a special case.
    //
    // consignor_id is matched to the partner record where one exists, so the
    // programme hangs off the same row their orders and invoices do rather
    // than becoming a second spelling of the same company.
    for (const [name, slug] of [
      ['Cult Wines', 'cult-wines'],
      ['Craft & Culture', 'craft-culture'],
    ]) {
      await client.unsafe(
        `INSERT INTO "tri_programmes" ("name", "slug", "identity_strategy", "consignor_id")
         SELECT $1, $2, 'lwin',
                (SELECT id FROM partners
                  WHERE lower(business_name) = lower($1) AND status = 'active'
                  LIMIT 1)
         WHERE NOT EXISTS (SELECT 1 FROM tri_programmes WHERE slug = $2)`,
        [name, slug],
      );
    }
    console.log('✅ tri_skus LWIN-first identity ready');

    // --- goods priced in the currency they were billed in --------------------
    // A euro invoice arrived with its prices already multiplied by roughly
    // 1.1666 and written into a column named USD, with nothing recording that
    // a conversion had happened or at what rate. Keeping what the document
    // said is what lets the shipment be priced once, at a rate someone chose,
    // and re-priced when that rate is corrected.
    for (const [column, type] of [
      ['source_currency', 'text'],
      ['source_unit_price', 'double precision'],
      ['source_total', 'double precision'],
    ]) {
      await client.unsafe(
        `ALTER TABLE "logistics_shipment_items" ADD COLUMN IF NOT EXISTS "${column}" ${type}`,
      );
    }

    for (const [column, type] of [
      ['source_currency', 'text'],
      ['fx_rate_to_usd', 'double precision'],
      ['fx_rate_date', 'date'],
      ['fx_rate_source', 'text'],
    ]) {
      await client.unsafe(
        `ALTER TABLE "logistics_shipments" ADD COLUMN IF NOT EXISTS "${column}" ${type}`,
      );
    }
    console.log('✅ shipment goods currency ready');

    // --- stock held for its owner rather than offered for sale ---------------
    // A client's cellar in storage is physically identical to bought stock and
    // was therefore listed for sale by every price surface, which read nothing
    // but "availableCases > 0". The line-level column is deliberately nullable
    // so it can inherit the shipment; the other two default false, which is
    // what every existing row already is.
    await client.unsafe(
      `ALTER TABLE "logistics_shipments" ADD COLUMN IF NOT EXISTS "not_for_sale" boolean NOT NULL DEFAULT false`,
    );
    await client.unsafe(
      `ALTER TABLE "logistics_shipment_items" ADD COLUMN IF NOT EXISTS "not_for_sale" boolean`,
    );
    await client.unsafe(
      `ALTER TABLE "wms_stock" ADD COLUMN IF NOT EXISTS "not_for_sale" boolean NOT NULL DEFAULT false`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "wms_stock_not_for_sale_idx"
         ON "wms_stock" ("not_for_sale") WHERE "not_for_sale" = true`,
    );
    console.log('✅ not-for-sale stock ready');

    // Trigram similarity is what lets a supplier's product name be matched
    // against 208k LWIN records without a person reading a result list per
    // line. Guarded so a database that already has it is untouched.
    await client.unsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "lwin_wines_display_name_trgm_idx"
         ON "lwin_wines" USING gin ("display_name" gin_trgm_ops)`,
    );
    console.log('✅ LWIN trigram matching ready');

    // Suppliers often send the workbook alongside the PDF of the same invoice.
    // It gets its own document type so both can sit on the shipment, and
    // because the sheet is the better source to read figures from.
    await client.unsafe(
      `ALTER TYPE "public"."logistics_document_type" ADD VALUE IF NOT EXISTS 'commercial_invoice_excel'`,
    );
    console.log('✅ commercial_invoice_excel document type ready');

    // --- what the supplier's paperwork says it shipped ----------------------
    // Held apart from our own totals because the point of it is the
    // disagreement: a shipment that reads 6 cartons against a document saying
    // 12 is a shipment somebody has to look at, and until now nothing recorded
    // the document's side of that at all.
    for (const [column, type] of [
      ['declared_cases', 'integer'],
      ['declared_bottles', 'integer'],
      ['declared_cartons', 'integer'],
      ['declared_pallets', 'integer'],
      ['declared_value', 'double precision'],
      ['declared_currency', 'text'],
      ['declared_source', 'text'],
      ['declared_confirmed_at', 'timestamp'],
      ['declared_confirmed_by', 'uuid'],
    ]) {
      await client.unsafe(
        `ALTER TABLE "logistics_shipments" ADD COLUMN IF NOT EXISTS "${column}" ${type}`,
      );
    }
    console.log('✅ declared shipment totals ready');

    // --- release belongs to an owner, not just to a wine ---------------------
    // The flag lived on wms_product_pricing, which is keyed on the wine alone,
    // so releasing a wine released everybody's holding of it — a client's
    // consignment appeared on the price lists because C&C had released its own
    // stock of the same wine.
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "wms_pricing_releases" (
        "lwin_key" text NOT NULL,
        "owner_id" uuid NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
        "released_at" timestamp NOT NULL DEFAULT now(),
        "released_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )`);
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "wms_pricing_releases_key_owner_idx"
         ON "wms_pricing_releases" ("lwin_key", "owner_id")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "wms_pricing_releases_owner_idx"
         ON "wms_pricing_releases" ("owner_id")`,
    );
    console.log('✅ per-owner pricing releases ready');

    /*
      Existing releases are carried over to Craft & Culture's own records only.

      Nothing recorded whose decision a release was — `pricing_released_by` is a
      user, not an owner — so it cannot be reconstructed. Every release to date
      was made when the flag was global and the price lists carried C&C's own
      book, so attributing them to C&C is the reading that matches what was
      meant. The alternative, giving every current holder a release, would bake
      in exactly the fault this table exists to remove: a client's consignment
      listed because someone released the same wine.

      Client stock therefore starts unreleased and is published deliberately,
      which is the point.
    */
    await dataFix('historic releases attributed to C&C', async () => {
      await client.unsafe(`
        INSERT INTO wms_pricing_releases (lwin_key, owner_id, released_at, released_by)
        SELECT DISTINCT
               split_part(p.lwin18, '-', 1) || '-' || split_part(p.lwin18, '-', 2)
                 || '-' || split_part(p.lwin18, '-', 4),
               pt.id,
               p.pricing_released_at,
               p.pricing_released_by
          FROM wms_product_pricing p
          CROSS JOIN partners pt
         WHERE p.pricing_released_at IS NOT NULL
           AND pt.business_name ~* 'craft.*culture'
        ON CONFLICT DO NOTHING
      `);
    });

    if (dataFixFailures.length > 0) {
      console.error(
        `\n⚠️  ${dataFixFailures.length} data backfill(s) did not run — schema is up to date and the deploy is good, but these need a follow-up:`,
      );
      dataFixFailures.forEach((label) => console.error(`   • ${label}`));
    }

    // --- variable pricing: margin bands + per-line overrides -----------------
    // Schema is fatal (the pricing query reads these); the seed is a data fix.
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "wms_pricing_bands" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "owner_id" uuid REFERENCES "partners"("id") ON DELETE CASCADE,
        "min_landed_per_bottle" double precision NOT NULL DEFAULT 0,
        "max_landed_per_bottle" double precision,
        "b2b_margin_pct" double precision NOT NULL,
        "pc_margin_pct" double precision NOT NULL,
        "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "wms_pricing_bands_owner_idx" ON "wms_pricing_bands"("owner_id")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "wms_pricing_bands_min_idx" ON "wms_pricing_bands"("min_landed_per_bottle")`,
    );
    await client.unsafe(
      `ALTER TABLE "wms_pricing_bands" DISABLE ROW LEVEL SECURITY`,
    );
    await client.unsafe(
      `ALTER TABLE "wms_product_pricing" ADD COLUMN IF NOT EXISTS "b2b_margin_pct" double precision`,
    );
    await client.unsafe(
      `ALTER TABLE "wms_product_pricing" ADD COLUMN IF NOT EXISTS "pc_margin_pct" double precision`,
    );
    console.log('✅ wms_pricing_bands ready');

    // House bands, only when none exist — never overwrite tuned figures.
    await dataFix('seed house pricing bands', async () => {
      await client.unsafe(`
        INSERT INTO "wms_pricing_bands"
          ("owner_id", "min_landed_per_bottle", "max_landed_per_bottle", "b2b_margin_pct", "pc_margin_pct")
        SELECT * FROM (VALUES
          (NULL::uuid, 0::double precision, 50::double precision, 30::double precision, 45::double precision),
          (NULL::uuid, 50, 200, 20, 35),
          (NULL::uuid, 200, 500, 14, 25),
          (NULL::uuid, 500, NULL, 10, 18)
        ) AS seed
        WHERE NOT EXISTS (SELECT 1 FROM "wms_pricing_bands" WHERE "owner_id" IS NULL)
      `);
    });

    // --- pricing release gate ------------------------------------------------
    await client.unsafe(
      `ALTER TABLE "wms_product_pricing" ADD COLUMN IF NOT EXISTS "pricing_released_at" timestamp`,
    );
    await client.unsafe(
      `ALTER TABLE "wms_product_pricing" ADD COLUMN IF NOT EXISTS "pricing_released_by" uuid REFERENCES "users"("id") ON DELETE SET NULL`,
    );
    console.log('✅ pricing release columns ready');

    // Everything already on a price list stays on it — the gate applies to what
    // arrives from here, not a blackout of the existing book.
    await dataFix('release pricing for wines already listed', async () => {
      await client.unsafe(`
        UPDATE "wms_product_pricing"
           SET "pricing_released_at" = now()
         WHERE "pricing_released_at" IS NULL
           AND EXISTS (
             SELECT 1 FROM "wms_stock" s
              WHERE s.lwin18 = "wms_product_pricing".lwin18
                AND s.available_cases > 0
                AND s.not_for_sale = false
           )
      `);
    });

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await client.end();
    process.exit(1);
  }
};

runMigrations();
