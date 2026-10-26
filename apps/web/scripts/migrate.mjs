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

    // Delivery notes: consignor address as it should read on the document,
    // separate from the origin fields that record where goods left from.
    console.log('🔄 Ensuring logistics_shipments.supplier_address column...');
    await client.unsafe(
      `ALTER TABLE "logistics_shipments" ADD COLUMN IF NOT EXISTS "supplier_address" text`,
    );
    console.log('✅ logistics_shipments.supplier_address ready');

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

    // PCO documents: a partner's sales order (Cru sends an SO, not an invoice).
    console.log('🔄 Ensuring private_client_document_type has partner_sales_order...');
    await client.unsafe(
      `ALTER TYPE "private_client_document_type" ADD VALUE IF NOT EXISTS 'partner_sales_order'`,
    );
    console.log('✅ private_client_document_type partner_sales_order ready');

    // Cellar transfers: the route wine takes to the UAE (UK bond, forwarder, in-UAE).
    console.log('🔄 Ensuring cellar_intakes.route column...');
    await client.unsafe(`ALTER TABLE "cellar_intakes" ADD COLUMN IF NOT EXISTS "route" text`);
    console.log('✅ cellar_intakes.route ready');

    // Shipments: UAE-to-UAE mainland transfer type.
    console.log('🔄 Ensuring logistics_shipment_type has mainland_transfer...');
    await client.unsafe(
      `ALTER TYPE "logistics_shipment_type" ADD VALUE IF NOT EXISTS 'mainland_transfer'`,
    );
    console.log('✅ logistics_shipment_type mainland_transfer ready');

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
    /*
      What the owner has billed us for, which nothing recorded.

      A consignment has two halves: City Drinks sells the wine, and its owner —
      Cru, Cult, Crurated, Rare, or ourselves — invoices us for what sold. Only
      the first half was modelled, so "has Cru billed us for that yet?" had no
      answer anywhere and was chased by hand every month.
    */
    await client.unsafe(
      `ALTER TYPE "tri_import_kind" ADD VALUE IF NOT EXISTS 'owner_invoice'`,
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

    /*
      Which inputs a client actually has, and therefore what its figures mean.

      `warehouse` is Crurated's shape: we hold the stock, so there is an
      opening position, a WMS count and a physical count to check the
      arithmetic against. `consignment` is two inputs — invoiced out, and
      reported sold, with unsold the difference.

      The column was declared in the Drizzle schema and never migrated, so
      every client was rendered in Crurated's five-input shape and the four
      that will never have a warehouse leg showed three permanently empty
      columns. Empty reads as broken rather than as not applicable.

      Defaulting to 'warehouse' keeps Crurated exactly as it is; the UPDATE
      below moves everyone else, since only the programme that holds stock in
      our own warehouse has the extra legs.
    */
    await client.unsafe(
      `ALTER TABLE "tri_programmes" ADD COLUMN IF NOT EXISTS "input_profile" text NOT NULL DEFAULT 'warehouse'`,
    );
    await client.unsafe(`
      UPDATE "tri_programmes"
      SET "input_profile" = 'consignment'
      WHERE "id" <> '${CRURATED_PROGRAMME_ID}'
        AND "input_profile" = 'warehouse'
    `);
    console.log('✅ tri_programmes input_profile ready');

    /*
      Which CONSIGNMENT_* tag on an invoice means this client.

      The invoice states its owner in the subject and the line records it, but
      nothing said which programme that owner IS. Deriving it from the
      programme's name works for Cult Wines and Crurated and breaks on C&C —
      "C&C" against "Craft & Culture" share no letters to match on — and a key
      derived two different ways is the fault that has cost this codebase five
      separate bugs. So it is stated once, here.

      `takes_unattributed` is for lines no tag claims: a CONSIGNMENT_MIX
      invoice, or one recognised only by its payment terms. Crurated takes
      them because that is where they have always gone, so nothing moves
      except the wine that now has a rightful owner.
    */
    await client.unsafe(
      `ALTER TABLE "tri_programmes" ADD COLUMN IF NOT EXISTS "consignment_tag" text`,
    );
    await client.unsafe(
      `ALTER TABLE "tri_programmes" ADD COLUMN IF NOT EXISTS "takes_unattributed" boolean NOT NULL DEFAULT false`,
    );
    await client.unsafe(`
      UPDATE "tri_programmes"
      SET "consignment_tag" = 'CRURATED', "takes_unattributed" = true
      WHERE "id" = '${CRURATED_PROGRAMME_ID}' AND "consignment_tag" IS NULL
    `);
    /*
      Everyone else is matched on the letters of their name, which is reliable
      for the four tags that are a word from it. Anything it does not match is
      left null and simply claims nothing until someone sets it — an unclaimed
      client is visible, whereas a wrongly claimed one is not.
    */
    for (const [tag, pattern] of [
      ['CULT', '%cult%'],
      ['CRU', '%cru wine%'],
      ['RARE', '%rare%'],
    ]) {
      await client.unsafe(`
        UPDATE "tri_programmes"
        SET "consignment_tag" = '${tag}'
        WHERE "consignment_tag" IS NULL
          AND LOWER("name") LIKE '${pattern}'
      `);
    }
    console.log('✅ tri_programmes consignment tags ready');

    /*
      Every consignment programme sells through City Drinks — that is what the
      reconciliation is about — so the Zoho customer is the same for all of
      them and only Crurated had it recorded. The others fell back to whatever
      the browser happened to remember, and on a browser that remembered
      nothing the sync was called with an empty customer and failed schema
      validation in front of the user.
    */
    await client.unsafe(`
      UPDATE "tri_programmes"
      SET "zoho_customer_match" = 'CD General'
      WHERE COALESCE("zoho_customer_match", '') = ''
    `);
    console.log('✅ tri_programmes Zoho customer ready');

    /*
      A wine belongs to the client whose registry it is in.

      tri_skus.owner_name defaults to Crurated, and the seeder never set it, so
      every wine created for any other client claimed Crurated — which put
      Cult's bottles under Crurated on the monthly statement. The programme's
      own consignment tag is the same key the invoice feed attributes by, so
      taking the owner from it means a wine and an invoice cannot disagree.

      Only rows still holding the default are touched: a wine somebody has
      deliberately assigned keeps that assignment.
    */
    await dataFix('tri_skus owner from their programme', async () => {
      await client.unsafe(`
        UPDATE "tri_skus" s
        SET "owner_name" = CASE p."consignment_tag"
              WHEN 'CC' THEN 'C&C'
              WHEN 'CRURATED' THEN 'Crurated'
              WHEN 'RARE' THEN 'Rare'
              WHEN 'CRU' THEN 'Cru'
              WHEN 'CULT' THEN 'Cult'
            END
        FROM "tri_programmes" p
        WHERE p."id" = s."programme_id"
          AND p."consignment_tag" IS NOT NULL
          AND p."id" <> '${CRURATED_PROGRAMME_ID}'
          AND COALESCE(s."owner_name", 'Crurated') = 'Crurated'
      `);
    });

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

    // --- private collectors ---------------------------------------------------
    // Individual members of the Private Cellar programme. They were being filed
    // as wine_partner, which grants sourcing and RFQ access they should not have.
    await client.unsafe(
      `ALTER TYPE "partner_type" ADD VALUE IF NOT EXISTS 'private_collector'`,
    );
    console.log('✅ private_collector partner type ready');

    // --- condition reports -----------------------------------------------
    // A chargeable inspection a cellar owner can order against their own wine.
    await client.unsafe(
      `ALTER TYPE "wms_request_type" ADD VALUE IF NOT EXISTS 'condition_report'`,
    );
    console.log('✅ condition_report request type ready');

    // --- cellar arrivals -------------------------------------------------
    // Telling an owner their wine has landed is the most useful message this
    // product sends, and it needs a type of its own so it can be muted alone.
    await client.unsafe(
      `ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'cellar_wine_received'`,
    );
    console.log('✅ cellar_wine_received notification type ready');

    // --- cellar release requests -------------------------------------------
    // A member asking for their own wine back out of bond. Not an order: what
    // is being agreed is the cost of clearance and delivery, so it carries a
    // quote and an approval before anything moves.
    await client.unsafe(`DO $$ BEGIN
      CREATE TYPE "cellar_release_status" AS ENUM
        ('draft','submitted','under_review','revision_requested','confirmed','cancelled');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    await client.unsafe(`CREATE TABLE IF NOT EXISTS "cellar_release_requests" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "request_number" text NOT NULL UNIQUE,
      "partner_id" uuid NOT NULL REFERENCES "partners"("id"),
      "requested_by" uuid NOT NULL REFERENCES "users"("id"),
      "status" "cellar_release_status" NOT NULL DEFAULT 'draft',
      "delivery_address" text,
      "member_notes" text,
      "admin_notes" text,
      "clearance_rate_version" text,
      "goods_value_usd" double precision,
      "clearance_cost_usd" double precision,
      "delivery_cost_usd" double precision,
      "total_cost_usd" double precision,
      "quoted_at" timestamp,
      "quoted_by" uuid REFERENCES "users"("id"),
      "submitted_at" timestamp,
      "confirmed_at" timestamp,
      "confirmed_by" uuid REFERENCES "users"("id"),
      "private_client_order_id" uuid,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )`);

    await client.unsafe(`CREATE TABLE IF NOT EXISTS "cellar_release_request_items" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "request_id" uuid NOT NULL REFERENCES "cellar_release_requests"("id") ON DELETE CASCADE,
      "stock_id" uuid REFERENCES "wms_stock"("id"),
      "lwin18" text NOT NULL,
      "product_name" text NOT NULL,
      "vintage" integer,
      "bottle_size" text,
      "case_config" integer,
      "bottles" integer NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )`);

    for (const [table, column] of [
      ['cellar_release_requests', 'partner_id'],
      ['cellar_release_requests', 'status'],
      ['cellar_release_request_items', 'request_id'],
    ]) {
      await client.unsafe(
        `CREATE INDEX IF NOT EXISTS "${table}_${column}_idx" ON "${table}" ("${column}")`,
      );
    }
    console.log('✅ cellar release requests ready');

    // --- release rates per member ------------------------------------------
    // What it costs a member to take their own wine out: duty, clearance,
    // transfer and the drive. A row with a null partner is the house default,
    // so a new member is quotable the day they join.
    await client.unsafe(`CREATE TABLE IF NOT EXISTS "cellar_release_rates" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "partner_id" uuid REFERENCES "partners"("id") ON DELETE CASCADE,
      "version" text NOT NULL DEFAULT 'v1',
      "duty_pct" double precision NOT NULL DEFAULT 0,
      "clearance_per_case" double precision NOT NULL DEFAULT 0,
      "clearance_per_bottle" double precision NOT NULL DEFAULT 0,
      "transfer_per_bottle" double precision NOT NULL DEFAULT 0,
      "delivery_flat" double precision NOT NULL DEFAULT 0,
      "delivery_per_case" double precision NOT NULL DEFAULT 0,
      "notes" text,
      "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )`);

    // One row per partner, and exactly one default. A partial index is needed
    // because NULLs do not collide in a plain unique index.
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "cellar_release_rates_partner_idx"
         ON "cellar_release_rates" ("partner_id") WHERE "partner_id" IS NOT NULL`,
    );
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "cellar_release_rates_default_idx"
         ON "cellar_release_rates" ((1)) WHERE "partner_id" IS NULL`,
    );
    console.log('✅ cellar release rates ready');

    // Margins: the licensed partner who delivers, and C&C for handling it.
    // Both take the declared value as their base, as the rate card describes.
    for (const [table, column] of [
      ['cellar_release_rates', 'distributor_margin_pct'],
      ['cellar_release_rates', 'cc_margin_pct'],
    ]) {
      await client.unsafe(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" double precision NOT NULL DEFAULT 0`,
      );
    }
    await client.unsafe(
      `ALTER TABLE "cellar_release_requests" ADD COLUMN IF NOT EXISTS "service_fee_usd" double precision`,
    );
    // VAT was missing entirely, and the per-case clearance fee beside the duty
    // percentage was the same money charged twice — what is paid at clearance
    // IS the duty. Dropped rather than left dormant: a column nothing reads is
    // a number somebody will one day set and wonder why it does nothing.
    await client.unsafe(
      `ALTER TABLE "cellar_release_rates" ADD COLUMN IF NOT EXISTS "vat_pct" double precision NOT NULL DEFAULT 0`,
    );
    for (const column of ['clearance_per_case', 'clearance_per_bottle']) {
      await client.unsafe(
        `ALTER TABLE "cellar_release_rates" DROP COLUMN IF EXISTS "${column}"`,
      );
    }
    console.log('✅ cellar release margins ready');

    // Where wine goes, kept apart from where the invoice goes, so correcting
    // one cannot silently reroute the other.
    for (const column of ['delivery_address', 'delivery_instructions']) {
      await client.unsafe(
        `ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "${column}" text`,
      );
    }
    console.log('✅ partner delivery address ready');

    // Emirates ID. The number and expiry sit on the member; the scans live in
    // their own table and are never served straight from blob storage.
    await client.unsafe(
      `ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "eid_number" text`,
    );
    await client.unsafe(
      `ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "eid_expiry" timestamp`,
    );
    await client.unsafe(
      `CREATE TABLE IF NOT EXISTS "partner_identity_documents" (
         "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         "partner_id" uuid NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
         "document_type" text NOT NULL,
         "file_url" text NOT NULL,
         "file_name" text NOT NULL,
         "mime_type" text NOT NULL,
         "file_size" integer NOT NULL DEFAULT 0,
         "uploaded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
         "created_at" timestamp DEFAULT now() NOT NULL,
         "updated_at" timestamp DEFAULT now() NOT NULL
       )`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "partner_identity_documents_partner_idx"
         ON "partner_identity_documents" ("partner_id")`,
    );
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "partner_identity_documents_unique_idx"
         ON "partner_identity_documents" ("partner_id", "document_type")`,
    );
    console.log('✅ partner identity documents ready');

    // A quote nobody is told about is a quote nobody accepts.
    for (const value of [
      'cellar_release_submitted',
      'cellar_release_quoted',
      'cellar_release_revision',
    ]) {
      await client.unsafe(
        `ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }
    console.log('✅ cellar release notifications ready');

    // A release must be picked from the parcel the member chose. Any bottle of
    // the same wine will do on a normal order; it will not do when the member
    // owns particular bottles with a particular lot.
    await client.unsafe(
      `ALTER TABLE "cellar_release_request_items" ADD COLUMN IF NOT EXISTS "lot_number" text`,
    );
    await client.unsafe(
      `ALTER TABLE "private_client_order_items" ADD COLUMN IF NOT EXISTS "source_stock_id" uuid`,
    );
    await client.unsafe(
      `ALTER TABLE "private_client_order_items" ADD COLUMN IF NOT EXISTS "source_lot_number" text`,
    );
    console.log('✅ release parcel identity ready');

    // Anything the rate card does not foresee, carried with its reason.
    await client.unsafe(
      `ALTER TABLE "cellar_release_requests" ADD COLUMN IF NOT EXISTS "additional_charge_usd" double precision`,
    );
    await client.unsafe(
      `ALTER TABLE "cellar_release_requests" ADD COLUMN IF NOT EXISTS "additional_charge_label" text`,
    );
    console.log('✅ release additional charge ready');

    // Two partners could not hold the same wine from one shipment in one bay,
    // so a partial ownership transfer raised a unique violation instead of
    // splitting the parcel. Adding a column to a unique index is a strict
    // weakening — every row that satisfied the old one satisfies this — so
    // there is nothing to clean up first and nothing to back-fill.
    await client.unsafe(
      `DROP INDEX IF EXISTS "wms_stock_lwin18_location_shipment_unique"`,
    );
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "wms_stock_lwin18_location_shipment_unique"
         ON "wms_stock" ("lwin18", "location_id", "shipment_id", "owner_id")`,
    );
    // A reservation must know whose wine it holds, or a shared pool settles to
    // whichever owner the matcher happened to pick.
    await client.unsafe(
      `ALTER TABLE "wms_stock_reservations" ADD COLUMN IF NOT EXISTS "owner_id" uuid REFERENCES "partners"("id")`,
    );
    console.log('✅ ownership transfer integrity ready');

    // A member's instruction to sell. Ownership does not move when wine is
    // offered — what changes is whether it may be sold, and by whom.
    await client.unsafe(`
      DO $$ BEGIN
        CREATE TYPE "sale_mandate_status" AS ENUM (
          'draft','offered','listed','placed','partially_sold','sold',
          'withdrawn','expired','suspended'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "sale_mandates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "mandate_number" text NOT NULL UNIQUE,
        "owner_id" uuid NOT NULL REFERENCES "partners"("id"),
        "owner_name" text NOT NULL,
        "lwin18" text NOT NULL,
        "lwin_key" text NOT NULL,
        "product_name" text NOT NULL,
        "producer" text,
        "vintage" integer,
        "bottle_size" text,
        "case_config" integer,
        "bottles_offered" integer NOT NULL,
        "bottles_remaining" integer NOT NULL,
        "ask_per_bottle_usd" double precision NOT NULL,
        "status" "sale_mandate_status" NOT NULL DEFAULT 'draft',
        "expires_at" timestamp,
        "owner_notes" text,
        "admin_notes" text,
        "offered_at" timestamp,
        "listed_at" timestamp,
        "listed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "withdrawn_at" timestamp,
        "withdrawn_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )`);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "sale_mandates_owner_idx" ON "sale_mandates" ("owner_id")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "sale_mandates_status_idx" ON "sale_mandates" ("status")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "sale_mandates_lwin_key_status_idx"
         ON "sale_mandates" ("lwin_key", "status")`,
    );

    // The exact parcels a mandate covers, and the hold state to put back if it
    // is withdrawn — most of a private cellar is held, so restoring to
    // "sellable" would quietly list the lot.
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "sale_mandate_lots" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "mandate_id" uuid NOT NULL REFERENCES "sale_mandates"("id") ON DELETE CASCADE,
        "stock_id" uuid NOT NULL REFERENCES "wms_stock"("id"),
        "location_id" uuid REFERENCES "wms_locations"("id"),
        "lot_number" text,
        "shipment_id" uuid REFERENCES "logistics_shipments"("id"),
        "re_export_boe_number" text,
        "bottles_offered" integer NOT NULL,
        "bottles_remaining" integer NOT NULL,
        "previous_not_for_sale" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )`);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "sale_mandate_lots_mandate_idx" ON "sale_mandate_lots" ("mandate_id")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "sale_mandate_lots_stock_idx" ON "sale_mandate_lots" ("stock_id")`,
    );
    console.log('✅ sale mandates ready');

    // A member offering wine, and hearing nothing back, is the same hole the
    // release flow had: they find out by logging in and looking.
    for (const value of ['mandate_offered', 'mandate_listed', 'mandate_sent_back']) {
      await client.unsafe(
        `ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }
    console.log('✅ mandate notifications ready');

    // A distributor is a place, not a void. Wine placed with one has to land
    // somewhere it can still be seen, owned and counted — today it is
    // decremented to zero and disappears from every screen.
    await client.unsafe(
      `ALTER TYPE "wms_location_type" ADD VALUE IF NOT EXISTS 'consignment'`,
    );
    await client.unsafe(
      `ALTER TABLE "wms_locations" ADD COLUMN IF NOT EXISTS "partner_id" uuid REFERENCES "partners"("id")`,
    );
    console.log('✅ consignment locations ready');

    // Placement is the hop that cannot be undone, so who decided it and where
    // it went outlive the mandate closing.
    for (const [column, type] of [
      ['placed_at', 'timestamp'],
      ['placed_by', 'uuid REFERENCES "users"("id") ON DELETE SET NULL'],
      ['placed_with_partner_id', 'uuid REFERENCES "partners"("id")'],
      ['placed_location_id', 'uuid'],
      ['commission_pct_override', 'double precision'],
    ]) {
      await client.unsafe(
        `ALTER TABLE "sale_mandates" ADD COLUMN IF NOT EXISTS "${column}" ${type}`,
      );
    }
    console.log('✅ mandate placement columns ready');

    // Breaking a sealed case is real work and was priced nowhere: wms_repacks
    // tracked that it happened without anyone being charged for it.
    await client.unsafe(
      `ALTER TABLE "cellar_release_rates" ADD COLUMN IF NOT EXISTS "repack_per_case" double precision NOT NULL DEFAULT 0`,
    );
    /*
      AED 25 per case opened, at the peg (25 × 0.2723 = 6.81). The card is
      denominated in USD like every other figure on it, so the dirham amount is
      converted once here rather than stored in a second currency.

      Guarded on 0 so it seeds an unconfigured card and never overwrites a rate
      somebody has since set deliberately.
    */
    await client.unsafe(
      `UPDATE "cellar_release_rates" SET "repack_per_case" = 6.81 WHERE "repack_per_case" = 0`,
    );
    console.log('✅ repack fee ready');

    // Selling a member's wine and owing them for it are two facts with two
    // clocks: the sale happens when a buyer takes it, the debt is payable when
    // the buyer's money is in. consignment_settlements has been migrated and
    // unwritten for a long time; this is what finally fills it.
    await client.unsafe(`DO $$ BEGIN
      CREATE TYPE "settlement_source" AS ENUM ('in_app', 'distributor', 'manual');
    EXCEPTION WHEN duplicate_object THEN null; END $$`);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "pool_sales" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sale_number" text NOT NULL UNIQUE,
        "mandate_id" uuid NOT NULL REFERENCES "sale_mandates"("id"),
        "mandate_lot_id" uuid REFERENCES "sale_mandate_lots"("id"),
        "stock_id" uuid REFERENCES "wms_stock"("id"),
        "owner_id" uuid NOT NULL REFERENCES "partners"("id"),
        "owner_name" text NOT NULL,
        "buyer_partner_id" uuid REFERENCES "partners"("id"),
        "buyer_name" text,
        "buyer_audience" text NOT NULL,
        "lwin18" text NOT NULL,
        "product_name" text NOT NULL,
        "bottles" integer NOT NULL,
        "case_config" integer,
        "sale_price_per_bottle_usd" double precision NOT NULL,
        "sale_total_usd" double precision NOT NULL,
        "ask_per_bottle_usd" double precision NOT NULL,
        "owed_to_owner_usd" double precision NOT NULL,
        "commission_pct" double precision NOT NULL,
        "commission_usd" double precision NOT NULL,
        "source" "settlement_source" NOT NULL DEFAULT 'in_app',
        "settlement_id" uuid REFERENCES "consignment_settlements"("id"),
        "sold_at" timestamp NOT NULL DEFAULT now(),
        "recorded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "notes" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )`);

    for (const idx of [
      `CREATE INDEX IF NOT EXISTS "pool_sales_mandate_idx" ON "pool_sales" ("mandate_id")`,
      `CREATE INDEX IF NOT EXISTS "pool_sales_owner_idx" ON "pool_sales" ("owner_id")`,
      `CREATE INDEX IF NOT EXISTS "pool_sales_settlement_idx" ON "pool_sales" ("settlement_id")`,
      `CREATE INDEX IF NOT EXISTS "pool_sales_sold_at_idx" ON "pool_sales" ("sold_at")`,
    ]) {
      await client.unsafe(idx);
    }

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "consignment_payout_runs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "run_number" text NOT NULL UNIQUE,
        "period_start" timestamp NOT NULL,
        "period_end" timestamp NOT NULL,
        "status" text NOT NULL DEFAULT 'draft',
        "total_usd" double precision NOT NULL DEFAULT 0,
        "member_count" integer NOT NULL DEFAULT 0,
        "approved_at" timestamp,
        "approved_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "paid_at" timestamp,
        "notes" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )`);

    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "consignment_payout_runs_status_idx" ON "consignment_payout_runs" ("status")`,
    );

    for (const [column, type] of [
      ['payout_run_id', 'uuid'],
      ['source', `text NOT NULL DEFAULT 'in_app'`],
    ]) {
      await client.unsafe(
        `ALTER TABLE "consignment_settlements" ADD COLUMN IF NOT EXISTS "${column}" ${type}`,
      );
    }

    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "consignment_settlements_payout_run_idx" ON "consignment_settlements" ("payout_run_id")`,
    );
    console.log('✅ pool sales and payout runs ready');

    // The book transfer: ownership moves, the case does not.
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cellar_purchases" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "purchase_number" text NOT NULL UNIQUE,
        "buyer_partner_id" uuid NOT NULL REFERENCES "partners"("id"),
        "buyer_name" text NOT NULL,
        "status" text NOT NULL DEFAULT 'reserved',
        "subtotal_usd" double precision NOT NULL DEFAULT 0,
        "total_usd" double precision NOT NULL DEFAULT 0,
        "reserved_until" timestamp,
        "extended_at" timestamp,
        "payment_claimed_at" timestamp,
        "payment_reference" text,
        "payment_confirmed_at" timestamp,
        "payment_confirmed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "completed_at" timestamp,
        "cancelled_at" timestamp,
        "notes" text,
        "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )`);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cellar_purchase_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "purchase_id" uuid NOT NULL REFERENCES "cellar_purchases"("id") ON DELETE CASCADE,
        "stock_id" uuid NOT NULL REFERENCES "wms_stock"("id"),
        "mandate_id" uuid REFERENCES "sale_mandates"("id"),
        "mandate_lot_id" uuid REFERENCES "sale_mandate_lots"("id"),
        "seller_partner_id" uuid REFERENCES "partners"("id"),
        "lwin18" text NOT NULL,
        "product_name" text NOT NULL,
        "producer" text,
        "vintage" integer,
        "bottle_size" text,
        "case_config" integer,
        "cases" integer NOT NULL,
        "bottles" integer NOT NULL,
        "price_per_bottle_usd" double precision NOT NULL,
        "line_total_usd" double precision NOT NULL,
        "reservation_id" uuid,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )`);

    for (const idx of [
      `CREATE INDEX IF NOT EXISTS "cellar_purchases_buyer_idx" ON "cellar_purchases" ("buyer_partner_id")`,
      `CREATE INDEX IF NOT EXISTS "cellar_purchases_status_idx" ON "cellar_purchases" ("status")`,
      `CREATE INDEX IF NOT EXISTS "cellar_purchases_reserved_until_idx" ON "cellar_purchases" ("reserved_until")`,
      `CREATE INDEX IF NOT EXISTS "cellar_purchase_items_purchase_idx" ON "cellar_purchase_items" ("purchase_id")`,
      `CREATE INDEX IF NOT EXISTS "cellar_purchase_items_stock_idx" ON "cellar_purchase_items" ("stock_id")`,
    ]) {
      await client.unsafe(idx);
    }
    console.log('✅ cellar purchases ready');

    // Repack as its own quote line, so it can carry an explanation and be
    // checked against the cases it is for.
    for (const [column, type] of [
      ['repack_cost_usd', 'double precision'],
      ['repack_cases', 'integer'],
    ]) {
      await client.unsafe(
        `ALTER TABLE "cellar_release_requests" ADD COLUMN IF NOT EXISTS "${column}" ${type}`,
      );
    }
    console.log('✅ release repack line ready');

    // A member whose hold lapsed has to hear about it, not find out when the
    // wine is gone.
    await client.unsafe(
      `ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'cellar_purchase_expired'`,
    );
    console.log('✅ purchase expiry notification ready');

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

    /*
      The invoice's subject and payment terms.

      A consignment invoice is marked as one in its subject — CONSIGNMENT_CC,
      CONSIGNMENT_CRURATED, CONSIGNMENT_MIX — and its terms read "Consignment"
      or "90 days". Neither was synced, so nothing downstream could tell a
      consignment line from an outright sale, and the monthly reconciliation
      had to be done by eye against the invoices themselves.
    */
    await client.unsafe(
      `ALTER TABLE "zoho_invoices" ADD COLUMN IF NOT EXISTS "subject" text`,
    );
    await client.unsafe(
      `ALTER TABLE "zoho_invoices" ADD COLUMN IF NOT EXISTS "payment_terms" text`,
    );
    console.log('✅ invoice subject and terms ready');

    /*
      Whose wine an import line is, as its own document declared it.

      The SKU carries an owner too, but it defaults every wine to Crurated, so
      it cannot split a statement by owner. An invoice subjected
      CONSIGNMENT_RARE states the answer outright, and this is where that
      statement is kept.
    */
    await client.unsafe(
      `ALTER TABLE "tri_import_lines" ADD COLUMN IF NOT EXISTS "stated_owner_name" text`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "tri_import_lines_stated_owner_idx" ON "tri_import_lines"("stated_owner_name")`,
    );
    console.log('✅ import line owner ready');

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

    /*
      The Zoho sales order raised from a private client order.

      The two systems were joined only by the PCO number written into the
      sales order's reference_number — readable by a person and by nothing
      else. A button that raises the order needs somewhere to record what it
      raised, so the PCO can link to it and so a second press cannot create a
      second order for the same wine.
    */
    await client.unsafe(
      `ALTER TABLE "private_client_orders" ADD COLUMN IF NOT EXISTS "zoho_salesorder_id" text`,
    );
    await client.unsafe(
      `ALTER TABLE "private_client_orders" ADD COLUMN IF NOT EXISTS "zoho_salesorder_number" text`,
    );
    await client.unsafe(
      `ALTER TABLE "private_client_orders" ADD COLUMN IF NOT EXISTS "zoho_salesorder_created_at" timestamp`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "private_client_orders_zoho_so_idx" ON "private_client_orders"("zoho_salesorder_id")`,
    );
    console.log('✅ PCO → Zoho sales order link ready');

    /*
      The subscription box an order is (tier, case size, variant). Cloning one
      checked order per box for every member needs the box named on the
      order, or the operator is left guessing which order is Discovery 3.
    */
    await client.unsafe(
      `ALTER TABLE "private_client_orders" ADD COLUMN IF NOT EXISTS "subscription_tier" text`,
    );
    await client.unsafe(
      `ALTER TABLE "private_client_orders" ADD COLUMN IF NOT EXISTS "subscription_case_size" integer`,
    );
    await client.unsafe(
      `ALTER TABLE "private_client_orders" ADD COLUMN IF NOT EXISTS "subscription_variant" text`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "private_client_orders_subscription_idx" ON "private_client_orders"("subscription_tier", "subscription_case_size")`,
    );
    console.log('✅ PCO subscription box columns ready');

    /*
      Which partners run a subscription club, opening the box tag and clone
      tool in their own portal. Switched on for Cru Wine — the only partner
      offering one — on the run that creates the column, and never again, so
      switching it off later in the database sticks.
    */
    const [subscriptionsColumn] = await client`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'partners' AND column_name = 'subscriptions_enabled'
    `;
    await client.unsafe(
      `ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "subscriptions_enabled" boolean NOT NULL DEFAULT false`,
    );
    if (!subscriptionsColumn) {
      await dataFix('Enable subscriptions for Cru Wine', async () => {
        const enabled = await client`
          UPDATE partners SET subscriptions_enabled = true
          WHERE type = 'wine_partner' AND LOWER(TRIM(business_name)) = 'cru wine'
          RETURNING id
        `;
        console.log(`   subscriptions enabled for ${enabled.length} partner(s)`);
      });
    }
    console.log('✅ Partner subscriptions flag ready');

    /*
      The distributor's bundle SKU for each PCO. City Drinks sells every PCO
      as one product named after the PCO number, with its own CDR SKU; it goes
      on the order (and the PCO label), and City Drinks must record it before
      the order can be marked client-paid.

      requires_order_sku is switched on for City Drinks once, on the run that
      creates the column, so switching it off later sticks. The same run links
      the City Drinks outlet (whose feed lists the bundles) to its partner
      record, which nothing had done.
    */
    await client.unsafe(
      `ALTER TABLE "private_client_orders" ADD COLUMN IF NOT EXISTS "distributor_sku" text`,
    );
    await client.unsafe(
      `ALTER TABLE "private_client_orders" ADD COLUMN IF NOT EXISTS "distributor_ref" text`,
    );
    await client.unsafe(
      `ALTER TABLE "private_client_orders" ADD COLUMN IF NOT EXISTS "distributor_sku_source" text`,
    );
    await client.unsafe(
      `ALTER TABLE "private_client_orders" ADD COLUMN IF NOT EXISTS "distributor_sku_set_at" timestamp`,
    );
    await client.unsafe(
      `ALTER TABLE "private_client_orders" ADD COLUMN IF NOT EXISTS "distributor_sku_set_by" uuid REFERENCES "users"("id") ON DELETE SET NULL`,
    );
    const [orderSkuColumn] = await client`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'partners' AND column_name = 'requires_order_sku'
    `;
    await client.unsafe(
      `ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "requires_order_sku" boolean NOT NULL DEFAULT false`,
    );
    if (!orderSkuColumn) {
      await dataFix('Require order SKUs from City Drinks', async () => {
        const cityDrinks = await client`
          SELECT id FROM partners
          WHERE type = 'distributor'
            AND (UPPER(TRIM(distributor_code)) = 'CD'
              OR LOWER(TRIM(business_name)) LIKE 'city drinks%')
        `;
        if (cityDrinks.length !== 1) {
          console.log(`   ${cityDrinks.length} City Drinks partner(s) found — not switched on; set requires_order_sku by hand`);
          return;
        }
        await client`
          UPDATE partners SET requires_order_sku = true WHERE id = ${cityDrinks[0].id}
        `;
        const linked = await client`
          UPDATE cons_outlets SET partner_id = ${cityDrinks[0].id}
          WHERE slug = 'city-drinks' AND partner_id IS NULL
          RETURNING id
        `;
        console.log(`   City Drinks requires order SKUs; ${linked.length} outlet linked`);
      });
    }
    console.log('✅ PCO distributor SKU columns ready');


    /* ───────────────────────── CONSIGNMENT ─────────────────────────────
       Wine placed with a retail outlet on consignment. Separate from tri_*,
       which keeps running for Crurated until this is proven.

       The unit carrying the rules is the arrangement — this owner's wine, at
       this outlet, on these terms — because Crurated are open-ended at City
       Drinks and 90 days at The Bottle Store.
    ─────────────────────────────────────────────────────────────────────── */
    await createEnum('cons_movement_kind', [
      'out',
      'sold',
      'billed',
      'credit',
    ]);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cons_outlets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "slug" text NOT NULL UNIQUE,
        "partner_id" uuid REFERENCES "partners"("id") ON DELETE SET NULL,
        "connector" text NOT NULL DEFAULT 'upload',
        "api_url" text,
        "api_token_env" text,
        "units" text NOT NULL DEFAULT 'bottle',
        "alias_source" text NOT NULL DEFAULT 'city_drinks',
        "zoho_customer_match" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "notes" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cons_owners" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "slug" text NOT NULL UNIQUE,
        "partner_id" uuid REFERENCES "partners"("id") ON DELETE SET NULL,
        "consignment_tag" text UNIQUE,
        "owner_aliases" text[],
        "wms_owner_match" text,
        "takes_unattributed" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "notes" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cons_arrangements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "owner_id" uuid NOT NULL REFERENCES "cons_owners"("id") ON DELETE CASCADE,
        "outlet_id" uuid NOT NULL REFERENCES "cons_outlets"("id") ON DELETE CASCADE,
        "terms_days" integer,
        "started_on" date,
        "is_active" boolean NOT NULL DEFAULT true,
        "notes" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "cons_arrangements_owner_outlet_unique" ON "cons_arrangements"("owner_id","outlet_id")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "cons_arrangements_outlet_idx" ON "cons_arrangements"("outlet_id")`,
    );

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cons_movements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "arrangement_id" uuid NOT NULL REFERENCES "cons_arrangements"("id") ON DELETE CASCADE,
        "kind" "cons_movement_kind" NOT NULL,
        "lwin18" text,
        "product_name" text NOT NULL,
        "outlet_code" text,
        "bottles" double precision NOT NULL DEFAULT 0,
        "source_qty" double precision,
        "source_unit" text,
        "pack" integer,
        "pack_assumed" boolean NOT NULL DEFAULT false,
        "unit_price" double precision,
        "currency" text,
        "doc_ref" text,
        "doc_date" date,
        "source" text,
        "raw" jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    for (const [name, cols] of [
      ['cons_movements_arrangement_idx', '"arrangement_id"'],
      ['cons_movements_kind_date_idx', '"kind","doc_date"'],
      ['cons_movements_lwin18_idx', '"lwin18"'],
      ['cons_movements_outlet_code_idx', '"outlet_code"'],
    ]) {
      await client.unsafe(
        `CREATE INDEX IF NOT EXISTS "${name}" ON "cons_movements"(${cols})`,
      );
    }

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cons_snapshots" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "outlet_id" uuid NOT NULL REFERENCES "cons_outlets"("id") ON DELETE CASCADE,
        "taken_at" timestamp NOT NULL,
        "outlet_code" text NOT NULL,
        "our_code" text,
        "lwin18" text,
        "product_name" text,
        "bottles_on_hand" double precision NOT NULL DEFAULT 0,
        "bottles_in_transit" double precision NOT NULL DEFAULT 0,
        "regime" text NOT NULL DEFAULT 'consigned',
        "sold_last_30d" double precision,
        "sold_last_90d" double precision,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "cons_snapshots_outlet_taken_code_unique" ON "cons_snapshots"("outlet_id","taken_at","outlet_code")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "cons_snapshots_outlet_taken_idx" ON "cons_snapshots"("outlet_id","taken_at")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "cons_snapshots_our_code_idx" ON "cons_snapshots"("our_code")`,
    );
    console.log('✅ consignment tables ready');

    /*
      Seed the outlets and owners we already trade with, and the arrangements
      between them. Terms per arrangement, not per party: Crurated are
      open-ended at City Drinks and 90 days everywhere else.

      A data fix rather than fatal DDL — a seed that fails should not hold back
      an unrelated deploy, and every row is ON CONFLICT DO NOTHING so it is
      safe to re-run and never overwrites a value someone has since edited.
    */
    await dataFix('consignment outlets, owners and arrangements', async () => {
      await client.unsafe(`
        INSERT INTO "cons_outlets"
          ("name","slug","connector","api_url","api_token_env","units","alias_source","zoho_customer_match")
        VALUES
          ('City Drinks','city-drinks','api',
           'https://craftculture.citydrinks.com/api/stock',
           'CITYDRINKS_API_TOKEN','bottle','city_drinks','CD General'),
          ('The Bottle Store','the-bottle-store','upload',
           NULL,NULL,'bottle','other','Bottle Store')
        ON CONFLICT ("slug") DO NOTHING
      `);

      await client.unsafe(`
        INSERT INTO "cons_owners"
          ("name","slug","consignment_tag","wms_owner_match","takes_unattributed")
        VALUES
          ('Craft & Culture','craft-culture','CC','CRAFT',false),
          ('Cru Wine','cru-wine','CRU','CRU WINE',false),
          ('Cult Wines','cult-wines','CULT','CULT',false),
          ('Crurated','crurated','CRURATED','CRURATED',true),
          ('Rare','rare','RARE','RARE',false)
        ON CONFLICT ("slug") DO NOTHING
      `);

      await client.unsafe(`
        INSERT INTO "cons_arrangements" ("owner_id","outlet_id","terms_days")
        SELECT ow."id", ou."id",
               CASE WHEN ow."slug" = 'crurated' AND ou."slug" = 'city-drinks'
                    THEN NULL ELSE 90 END
        FROM "cons_owners" ow
        CROSS JOIN "cons_outlets" ou
        WHERE ou."slug" = 'city-drinks'
        ON CONFLICT ("owner_id","outlet_id") DO NOTHING
      `);
    });


    /*
      Bills — the other side of the money.

      An owner's invoice for consigned wine that sold is a supplier bill, so
      once it is in Zoho "has Cru billed us?" is "does a bill exist" and "have
      we paid?" is its balance. Mirrors zoho_invoices deliberately.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "zoho_bills" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "zoho_bill_id" text NOT NULL UNIQUE,
        "bill_number" text NOT NULL,
        "zoho_vendor_id" text,
        "vendor_name" text NOT NULL,
        "status" text NOT NULL,
        "bill_date" date NOT NULL,
        "due_date" date,
        "reference_number" text,
        "notes" text,
        "sub_total" double precision NOT NULL DEFAULT 0,
        "total" double precision NOT NULL DEFAULT 0,
        "balance" double precision NOT NULL DEFAULT 0,
        "currency_code" text,
        "line_items" jsonb,
        "last_sync_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    for (const [name, col] of [
      ['zoho_bills_vendor_idx', '"vendor_name"'],
      ['zoho_bills_date_idx', '"bill_date"'],
      ['zoho_bills_status_idx', '"status"'],
    ]) {
      await client.unsafe(
        `CREATE INDEX IF NOT EXISTS "${name}" ON "zoho_bills"(${col})`,
      );
    }
    console.log('✅ zoho_bills ready');


    /*
      A distributor's code tied to a wine of ours — the join the data cannot
      make alone. Only Crurated issue codes the distributor holds and our
      warehouse can translate; everyone else's are labels the distributor
      invented. Proposed from the wine's name, confirmed by a person, then
      never asked again.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cons_code_links" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "outlet_id" uuid NOT NULL REFERENCES "cons_outlets"("id") ON DELETE CASCADE,
        "outlet_code" text NOT NULL,
        "lwin18" text NOT NULL,
        "outlet_product_name" text,
        "our_product_name" text,
        "source" text NOT NULL DEFAULT 'confirmed',
        "confirmed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "cons_code_links_outlet_code_unique" ON "cons_code_links"("outlet_id","outlet_code")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "cons_code_links_lwin18_idx" ON "cons_code_links"("lwin18")`,
    );
    console.log('✅ cons_code_links ready');

    /*
      Why a line's owner is its owner.

      `resolveOwner` works it out on every line and the answer was thrown away,
      so a line that went to whoever takes unattributed wine read exactly like
      one the invoice named. That difference is who gets paid.
    */
    await client.unsafe(
      `ALTER TABLE "cons_movements" ADD COLUMN IF NOT EXISTS "owner_reason" text`,
    );
    console.log('✅ cons_movements.owner_reason ready');

    /*
      OpenCellar is Crurated.

      Four City Drinks invoices name the wine as OpenCellar's, which matches no
      owner, so every line on them went to whoever takes the unattributed. That
      happened to be Crurated, so the answer was right by accident and would
      have become wrong the moment the catch-all changed hands.
    */
    await client.unsafe(`
      UPDATE "cons_owners"
      SET "owner_aliases" = array_append(COALESCE("owner_aliases", '{}'), 'OPENCELLAR')
      WHERE UPPER("consignment_tag") = 'CRURATED'
        AND NOT ('OPENCELLAR' = ANY(COALESCE("owner_aliases", '{}')))
    `);
    console.log('✅ OpenCellar reads as Crurated');

    /*
      Whose a wine is, said by a person, when no document can say it.

      Zoho returns none of the header rows a CONSIGNMENT_MIX invoice uses to
      group its lines — 292 rows read, 0 headers among them — so INV-000236
      prints three owners on its face and sends seventeen anonymous lines. No
      parser recovers that. Somebody has to say it once per wine, and be
      believed ever after.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cons_wine_owners" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "outlet_id" uuid NOT NULL REFERENCES "cons_outlets"("id") ON DELETE CASCADE,
        "lwin18" text NOT NULL,
        "owner_id" uuid NOT NULL REFERENCES "cons_owners"("id") ON DELETE CASCADE,
        "product_name" text,
        "set_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "cons_wine_owners_unique" ON "cons_wine_owners"("outlet_id","lwin18")`,
    );
    console.log('✅ cons_wine_owners ready');

    /*
      Lines the distributor buys rather than holds for us.

      A fast mover they would rather own: City Drinks take the line onto their
      own book and consignment on it ends. Their stock of it then answers to
      nobody here, and counting it as a position we are owed against makes a
      total that reads right and is not.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cons_wine_bought" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "outlet_id" uuid NOT NULL REFERENCES "cons_outlets"("id") ON DELETE CASCADE,
        "lwin18" text NOT NULL,
        "product_name" text,
        "note" text,
        "set_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "cons_wine_bought_unique" ON "cons_wine_bought"("outlet_id","lwin18")`,
    );
    console.log('✅ cons_wine_bought ready');

    /*
      Lines closed because the distributor holds none.

      A date rather than a flag, because a closed line is a statement about a
      moment and replenishment happens. Anything sent after that date, or any
      stock appearing on their feed, reopens it without anyone remembering to.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cons_wine_closed" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "outlet_id" uuid NOT NULL REFERENCES "cons_outlets"("id") ON DELETE CASCADE,
        "lwin18" text NOT NULL,
        "product_name" text,
        "closed_at" date NOT NULL DEFAULT CURRENT_DATE,
        "set_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "cons_wine_closed_unique" ON "cons_wine_closed"("outlet_id","lwin18")`,
    );
    console.log('✅ cons_wine_closed ready');

    /*
      Lines on the distributor's sheet that reach no wine of ours.

      They were counted in a toast and then gone, which is the same as dropping
      them: a bottle sold that we cannot attribute is money nobody will ever be
      billed for, and it has to stay on the screen until somebody answers it.
      Replaced wholesale each time a month is re-imported.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cons_import_unmatched" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "outlet_id" uuid NOT NULL REFERENCES "cons_outlets"("id") ON DELETE CASCADE,
        "month" text NOT NULL,
        "outlet_code" text,
        "product_name" text,
        "bottles" double precision NOT NULL DEFAULT 0,
        "reason" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "cons_import_unmatched_month_idx" ON "cons_import_unmatched"("outlet_id","month")`,
    );
    console.log('✅ cons_import_unmatched ready');

    /*
      What a wine cost its owner, remembered.

      Two faults it answers. A wine that sells out drops off the Pricing
      Manager, taking its landed cost with it — and a sale made last month
      still has to be priced this month, so the last known cost is kept rather
      than looked up and found missing. And one wine can belong to two owners
      at two costs (Montille Bourgogne Blanc, Dancer Hautes-Cotes Blanc, held
      by both Crurated and Ihab), which a per-wine price cannot express.

      Keyed per owner and pack-agnostically, so a wine invoiced in sixes and in
      singles is one wine, as it is everywhere else here.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cons_wine_landed" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "owner_id" uuid NOT NULL REFERENCES "cons_owners"("id") ON DELETE CASCADE,
        "wine_key" text NOT NULL,
        "lwin18" text,
        "product_name" text,
        "landed_per_bottle" double precision NOT NULL,
        "source" text NOT NULL DEFAULT 'pricing-manager',
        "set_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "cons_wine_landed_unique" ON "cons_wine_landed"("owner_id","wine_key")`,
    );
    console.log('✅ cons_wine_landed ready');

    /*
      Export invoices — the combined commercial invoice & packing list.

      The document is JSON; versions keep every state with the ops and request
      behind it; sources snapshot the Zoho invoices so a reissued invoice is
      caught; consignee profiles hold currency and standing rules. The two
      consignees exported to so far are seeded from the synced invoices, with
      the address and TRN customs have accepted on earlier documents.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "export_invoices" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "number" text UNIQUE,
        "zoho_customer_id" text NOT NULL,
        "consignee_name" text NOT NULL,
        "status" text NOT NULL DEFAULT 'draft',
        "document" jsonb NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "pdf_url" text,
        "issued_at" timestamp,
        "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "export_invoices_customer_idx" ON "export_invoices"("zoho_customer_id")`,
    );
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "export_invoice_versions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "export_invoice_id" uuid NOT NULL REFERENCES "export_invoices"("id") ON DELETE CASCADE,
        "version" integer NOT NULL,
        "document" jsonb NOT NULL,
        "ops" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "request" text,
        "change_summary" text,
        "pdf_url" text,
        "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "export_invoice_versions_unique" ON "export_invoice_versions"("export_invoice_id","version")`,
    );
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "export_invoice_sources" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "export_invoice_id" uuid NOT NULL REFERENCES "export_invoices"("id") ON DELETE CASCADE,
        "zoho_invoice_id" text NOT NULL,
        "invoice_number" text NOT NULL,
        "snapshot_total" double precision NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "export_invoice_sources_export_idx" ON "export_invoice_sources"("export_invoice_id")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "export_invoice_sources_zoho_idx" ON "export_invoice_sources"("zoho_invoice_id")`,
    );
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "export_consignee_profiles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "zoho_customer_id" text NOT NULL UNIQUE,
        "display_name" text NOT NULL,
        "address_lines" jsonb,
        "trn" text,
        "currency" text NOT NULL DEFAULT 'AED',
        "rate" double precision NOT NULL DEFAULT 3.6725,
        "standing_rules" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`
      INSERT INTO "export_consignee_profiles" ("zoho_customer_id","display_name","address_lines","trn")
      SELECT DISTINCT ON (zoho_customer_id) zoho_customer_id, 'C D General Trading L.L.C',
        '["09 Al Mamoura Building","Khalifa Industrial Area","Abu Dhabi Ports Company PJSC","United Arab Emirates"]'::jsonb,
        '104077092500003'
      FROM "zoho_invoices" WHERE customer_name ILIKE 'C D General Trading%'
      ON CONFLICT ("zoho_customer_id") DO NOTHING
    `);
    await client.unsafe(`
      INSERT INTO "export_consignee_profiles" ("zoho_customer_id","display_name","address_lines","trn")
      SELECT DISTINCT ON (zoho_customer_id) zoho_customer_id, 'The Bottle Store General Trading LLC – SPC',
        '["Al Saman Towers","Sheikh Hamdan Bin Mohammed Street 31945","Abu Dhabi","United Arab Emirates"]'::jsonb,
        '100451466500003'
      FROM "zoho_invoices" WHERE customer_name ILIKE 'The Bottle Store%'
      ON CONFLICT ("zoho_customer_id") DO NOTHING
    `);
    console.log('✅ export invoices ready');

    /*
      Zoho code cleanup — every write to a Zoho item (SKU dashed or renamed,
      item made inactive), so a batch can be undone.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "zoho_item_changes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "batch_id" uuid NOT NULL,
        "zoho_item_id" text NOT NULL,
        "item_name" text NOT NULL,
        "action" text NOT NULL,
        "before_sku" text,
        "after_sku" text,
        "reason" text,
        "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "undone_at" timestamp,
        "undone_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "zoho_item_changes_batch_idx" ON "zoho_item_changes"("batch_id")`,
    );
    await client.unsafe(`ALTER TABLE "zoho_item_changes" ADD COLUMN IF NOT EXISTS "before_name" text`);
    await client.unsafe(`ALTER TABLE "zoho_item_changes" ADD COLUMN IF NOT EXISTS "after_name" text`);
    await client.unsafe(`ALTER TABLE "zoho_item_changes" ADD COLUMN IF NOT EXISTS "before_details" jsonb`);
    await client.unsafe(`ALTER TABLE "zoho_item_changes" ADD COLUMN IF NOT EXISTS "after_details" jsonb`);
    console.log('✅ zoho item changes ready');

    /*
      Team Tasks — the team's shared to-do list (jobs, each split into parts
      owned by one person). Tables first; then, once only, the areas and the
      3 October 2026 list the team was working from, so the page opens on real
      work. The seed is a data backfill: it never blocks a deploy.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "team_task_areas" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" text NOT NULL UNIQUE,
        "position" integer NOT NULL DEFAULT 0,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "team_tasks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" text NOT NULL,
        "area_id" uuid NOT NULL REFERENCES "team_task_areas"("id") ON DELETE RESTRICT,
        "for_tag" text,
        "urgent" boolean NOT NULL DEFAULT false,
        "waiting_on" text,
        "repeat" text,
        "status" text NOT NULL DEFAULT 'open',
        "closed_at" timestamp,
        "closed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "team_tasks_status_idx" ON "team_tasks"("status")`);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "team_tasks_area_idx" ON "team_tasks"("area_id")`);
    // Team Tasks: a job can point at the order it is about, and be shared with one partner
    await client.unsafe(`ALTER TABLE "team_tasks" ADD COLUMN IF NOT EXISTS "link_url" text`);
    await client.unsafe(`ALTER TABLE "team_tasks" ADD COLUMN IF NOT EXISTS "link_label" text`);
    await client.unsafe(`ALTER TABLE "team_tasks" ADD COLUMN IF NOT EXISTS "partner_id" uuid REFERENCES "partners"("id") ON DELETE SET NULL`);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "team_tasks_link_idx" ON "team_tasks"("link_url")`);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "team_tasks_partner_idx" ON "team_tasks"("partner_id")`);
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "team_task_parts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "task_id" uuid NOT NULL REFERENCES "team_tasks"("id") ON DELETE CASCADE,
        "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "what" text NOT NULL,
        "due" date,
        "done" boolean NOT NULL DEFAULT false,
        "done_at" timestamp,
        "done_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "waits_for_part_id" uuid,
        "overdue_notified_at" timestamp,
        "position" integer NOT NULL DEFAULT 0,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "team_task_parts_task_idx" ON "team_task_parts"("task_id")`);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "team_task_parts_owner_idx" ON "team_task_parts"("owner_id")`);
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "team_task_notes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "task_id" uuid NOT NULL REFERENCES "team_tasks"("id") ON DELETE CASCADE,
        "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "body" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "team_task_notes_task_idx" ON "team_task_notes"("task_id")`);
    // Team Tasks: files attached to a job (stored in Blob; this row links them)
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "team_task_attachments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "task_id" uuid NOT NULL REFERENCES "team_tasks"("id") ON DELETE CASCADE,
        "file_url" text NOT NULL,
        "file_name" text NOT NULL,
        "mime_type" text,
        "file_size" integer,
        "uploaded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "team_task_attachments_task_idx" ON "team_task_attachments"("task_id")`);
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "team_task_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "task_id" uuid NOT NULL REFERENCES "team_tasks"("id") ON DELETE CASCADE,
        "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "text" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "team_task_events_task_idx" ON "team_task_events"("task_id")`);
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "team_task_people" (
        "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
        "slack_member_id" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('✅ team tasks tables ready');

    await dataFix('Team Tasks: areas and the 3 October list', async () => {
      const areaNames = ['System & Tech', 'Finance', 'Customers', 'Clients', 'Distributors', 'Internal', 'Other'];
      for (const [i, name] of areaNames.entries()) {
        await client`INSERT INTO "team_task_areas" ("name","position") VALUES (${name}, ${i}) ON CONFLICT ("name") DO NOTHING`;
      }

      const [{ count }] = await client`SELECT count(*)::int AS count FROM "team_tasks"`;
      if (count > 0) return;

      // Team members by first name; "Jo" signs in as Jyothi.
      const staff = await client`
        SELECT id, name FROM "users"
        WHERE role IN ('admin','wms_operator') AND lower(email) LIKE '%@craftculture.xyz'
      `;
      const who = (first) => {
        const hit = staff.find((u) => u.name.trim().toLowerCase().startsWith(first));
        return hit ? hit.id : null;
      };
      const people = { kevin: who('kevin'), sophie: who('sophie'), jo: who('jyothi') ?? who('jo'), laraine: who('laraine') };
      const areas = Object.fromEntries((await client`SELECT id, name FROM "team_task_areas"`).map((a) => [a.name, a.id]));

      const jobs = [
        { t: 'Consignment Tool: get working', a: 'System & Tech', u: true, p: [['kevin', 'Get it working']] },
        { t: 'Rate card: update', a: 'System & Tech', p: [['kevin', 'Update rate card']] },
        { t: 'TBS: preorder sheet update', a: 'System & Tech', u: true, p: [['sophie', 'Update the sheet', true], ['kevin', 'Load onto live price list']] },
        { t: 'Consignment invoices: reconciliation', a: 'Finance', u: true, p: [['laraine', 'Reconcile consignment invoices']] },
        { t: 'Cru & Crurated: update pricing to new 15% tax', a: 'Finance', p: [['sophie', 'Cru PCO and new wines only']] },
        { t: 'Wynn: pricing matrix & transfer', a: 'Customers', u: true, p: [['sophie', 'Pricing matrix, with Abhishek'], ['kevin', 'Alignment and coding', false, 0], ['jo', 'Manage transfer']] },
        { t: 'Philipp: code qty errors in pricing manager', a: 'Clients', u: true, f: 'client', p: [['kevin', 'Fix quantity errors in Pricing Manager']] },
        { t: 'Isabel Mayfair: shipping quote, set up & invoice', a: 'Clients', f: 'client', w: 'Client go-ahead', p: [['jo', 'Shipping quote'], ['laraine', 'Set up in system and invoice (Kevin to instruct)']] },
        { t: 'Said: contract, rate card & pricing check', a: 'Clients', f: 'client', w: 'Client go-ahead', p: [['kevin', 'Send contract'], ['sophie', 'Check pricing'], ['jo', 'Logistics quote', true]] },
        { t: 'Julian: price list & interactive pricing portal', a: 'Clients', f: 'client', w: 'Client go-ahead', p: [['sophie', 'Price list'], ['kevin', 'Build portal']] },
        { t: 'CD replen & RFQ', a: 'Distributors', f: 'distributor', p: [['kevin', 'Replenishment and RFQ']] },
        { t: 'Company strategy & scaling', a: 'Internal', p: [['kevin', 'Strategy and scaling plan']] },
        { t: '2026 P&L', a: 'Internal', p: [['sophie', 'Prepare 2026 P&L']] },
        { t: 'Cult: arrange air freight', a: 'Other', p: [] },
        { t: 'Box: procure new boxes', a: 'Other', u: true, p: [['laraine', "Check samples and order new boxes (under Kevin's instruction)"]] },
      ];
      const done = [
        ['City Drinks: send feedback', '2026-10-03'], ['City Drinks: collection admin', '2026-10-03'], ['Cult Wine: settle mutual payments', '2026-10-03'],
        ['Altamura: storage Apr to Sep', '2026-10-03'], ['Cru: consulting support & repack', '2026-10-03'], ['PCO: code copy & paste function', '2026-10-02'],
        ['Tax return: Kevin sign-off', '2026-10-02'], ['Albert: 3x unpaid invoices (inc. cheque)', '2026-10-01'], ['Compass Box: pay outstanding', '2026-10-01'],
        ['Share invoices with clients', '2026-09-30'], ['Chase outstanding payments', '2026-09-30'], ["Ihab's case at Yuvraj house", '2026-09-30'],
        ['TBS (Jeandre): wine consignment list', '2026-09-29'], ['TBS: invoice Daniel re. missing bottle of Figeac', '2026-09-29'], ['JMK: send wine model', '2026-09-29'],
        ['Cru: send product list for shipment', '2026-09-28'], ['Cru: City Drinks collection', '2026-09-28'], ['Cru: add-on subscriptions packing', '2026-09-27'],
        ['Cru: PCOs to be input', '2026-09-27'], ['Crurated: air freight (push with Walid)', '2026-09-27'], ['Laraine: induction', '2026-09-26'], ['Said: logistics cost quote (Jo)', '2026-09-26'],
      ];

      const missing = new Set();
      for (const job of jobs) {
        const [task] = await client`
          INSERT INTO "team_tasks" ("title","area_id","for_tag","urgent","waiting_on")
          VALUES (${job.t}, ${areas[job.a]}, ${job.f ?? null}, ${job.u ?? false}, ${job.w ?? null})
          RETURNING id
        `;
        const ids = [];
        for (const [i, [key, what, isDone, waitsIdx]] of job.p.entries()) {
          if (!people[key]) { missing.add(key); ids.push(null); continue; }
          const waits = waitsIdx === undefined ? null : ids.at(waitsIdx) ?? null;
          const [part] = await client`
            INSERT INTO "team_task_parts" ("task_id","owner_id","what","done","done_at","waits_for_part_id","position")
            VALUES (${task.id}, ${people[key]}, ${what}, ${isDone ?? false}, ${isDone ? new Date() : null}, ${waits}, ${i})
            RETURNING id
          `;
          ids.push(part.id);
        }
        await client`INSERT INTO "team_task_events" ("task_id","text") VALUES (${task.id}, 'Carried over from the 3 October list')`;
      }
      for (const [title, day] of done) {
        const [task] = await client`
          INSERT INTO "team_tasks" ("title","area_id","status","closed_at")
          VALUES (${title}, ${areas.Other}, 'closed', ${day + 'T12:00:00Z'})
          RETURNING id
        `;
        await client`INSERT INTO "team_task_events" ("task_id","text") VALUES (${task.id}, 'Done before Team Tasks started')`;
      }
      if (missing.size) console.log(`⚠️  Team Tasks seed: no staff login found for ${[...missing].join(', ')}; their parts were left unassigned`);
    });

    await dataFix('Team Tasks: wording as on the 3 October list', async () => {
      // Titles and parts read exactly as the PDF did. Only text still as seeded
      // is changed, so anything the team has since edited is left alone.
      const titles = [
        ['Consignment Tool: get working', 'Consignment Tool — get working'],
        ['Rate card: update', 'Rate card — update'],
        ['TBS: preorder sheet update', 'TBS — preorder sheet update'],
        ['Consignment invoices: reconciliation', 'Consignment invoices — reconciliation'],
        ['Cru & Crurated: update pricing to new 15% tax', 'Cru & Crurated — update pricing to new 15% tax'],
        ['Wynn: pricing matrix & transfer', 'Wynn — pricing matrix & transfer'],
        ['Philipp: code qty errors in pricing manager', 'Philipp — code qty errors in pricing manager'],
        ['Isabel Mayfair: shipping quote, set up & invoice', 'Isabel Mayfair — shipping quote + set up in system & invoice'],
        ['Said: contract, rate card & pricing check', 'Said — contract, rate card & pricing check'],
        ['Julian: price list & interactive pricing portal', 'Julian — price list & interactive pricing portal'],
        ['Cult: arrange air freight', 'Cult — arrange air freight'],
        ['Box: procure new boxes', 'Box — procure new boxes'],
      ];
      for (const [from, to] of titles) {
        await client`UPDATE "team_tasks" SET "title" = ${to}, "updated_at" = now() WHERE "title" = ${from}`;
      }
      const parts = [
        ['Get it working', 'Consignment Tool — get working'],
        ['Update rate card', 'Rate card — update'],
        ['Update the sheet', 'Sheet updated'],
        ['Load onto live price list', 'TBS — load preorder sheet onto live price list'],
        ['Reconcile consignment invoices', 'Consignment invoices — reconciliation'],
        ['Cru PCO and new wines only', 'Cru & Crurated — update pricing to 15% tax (Cru PCO & new wines)'],
        ['Pricing matrix, with Abhishek', 'Wynn — pricing matrix & Abhishek conversation re. transfer'],
        ['Alignment and coding', 'Wynn — code pricing matrix (once Sophie sends)'],
        ['Manage transfer', 'Wynn — manage transfer'],
        ['Fix quantity errors in Pricing Manager', 'Philipp — code qty errors in pricing manager'],
        ['Shipping quote', 'Isabel Mayfair — shipping quote'],
        ['Set up in system and invoice (Kevin to instruct)', 'Isabel Mayfair — set up in system & invoice (Kevin to instruct)'],
        ['Send contract', 'Said — send contract'],
        ['Check pricing', 'Said — check pricing'],
        ['Logistics quote', 'Said — logistics quote'],
        ['Price list', 'Julian — pricing for price list & portal'],
        ['Build portal', 'Julian — build interactive pricing portal'],
        ['Replenishment and RFQ', 'CD replen & RFQ'],
        ['Strategy and scaling plan', 'Company strategy & scaling'],
        ['Prepare 2026 P&L', '2026 P&L'],
        ["Check samples and order new boxes (under Kevin's instruction)", "Box — check samples & order new boxes (under Kevin's instruction)"],
      ];
      for (const [from, to] of parts) {
        await client`UPDATE "team_task_parts" SET "what" = ${to}, "updated_at" = now() WHERE "what" = ${from}`;
      }
      const done = [
        ['Altamura: storage Apr to Sep', 'Altamura — storage Apr–Sep'], ['Tax return: Kevin sign-off', 'Tax return — Kevin sign off'],
      ];
      for (const [from, to] of done) {
        await client`UPDATE "team_tasks" SET "title" = ${to} WHERE "title" = ${from}`;
      }
      await client`UPDATE "team_tasks" SET "title" = regexp_replace("title", '^([^:]+): ', '\\1 — ') WHERE "status" = 'closed' AND "title" ~ '^[^:]+: '`;
    });

    /*
      Logistics jobs and movement bonds — export jobs numbered EXP-CNC/YY/NNNN,
      and the bond C&C puts down on a bonded transfer. New tables beside
      logistics_shipments, so no existing shipment query depends on them.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "logistics_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "shipment_id" uuid NOT NULL UNIQUE REFERENCES "logistics_shipments"("id") ON DELETE CASCADE,
        "kind" text NOT NULL,
        "job_number" text NOT NULL UNIQUE,
        "stage" text NOT NULL,
        "bonded_transfer" boolean NOT NULL DEFAULT false,
        "client_name" text NOT NULL,
        "zoho_customer_id" text,
        "export_invoice_id" uuid REFERENCES "export_invoices"("id") ON DELETE SET NULL,
        "invoice_number" text,
        "invoice_value" double precision,
        "invoice_currency" text NOT NULL DEFAULT 'AED',
        "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "logistics_jobs_kind_idx" ON "logistics_jobs"("kind")`);
    // One shipment can carry several Zoho invoices and several export invoices
    await client.unsafe(`ALTER TABLE "logistics_jobs" ADD COLUMN IF NOT EXISTS "additional_invoices" jsonb NOT NULL DEFAULT '[]'::jsonb`);
    await client.unsafe(`ALTER TABLE "logistics_jobs" ADD COLUMN IF NOT EXISTS "additional_export_invoice_ids" uuid[] NOT NULL DEFAULT '{}'::uuid[]`);
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "logistics_movement_bonds" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "shipment_id" uuid NOT NULL UNIQUE REFERENCES "logistics_shipments"("id") ON DELETE CASCADE,
        "goods_value" double precision,
        "bond_amount" double precision,
        "currency" text NOT NULL DEFAULT 'AED',
        "declaration_number" text,
        "paid_on" date,
        "arrived_on" date,
        "stamped_on" date,
        "claim_submitted_on" date,
        "refunded_on" date,
        "refund_amount" double precision,
        "reminders_sent" text[] NOT NULL DEFAULT '{}'::text[],
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('✅ logistics jobs + movement bonds ready');

    // The balance each invoice had when #payments-received last posted
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "zoho_payment_alerts" (
        "zoho_invoice_id" text PRIMARY KEY,
        "announced_balance" double precision NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    /*
      Purchasing: a distributor's replenishment sheet and our answer to each
      line. Kept whole — header and every original cell — because the answer
      goes back as their own file with our status written beside it.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "purchasing_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "outlet_id" uuid REFERENCES "cons_outlets"("id") ON DELETE SET NULL,
        "distributor_name" text NOT NULL,
        "file_name" text,
        "source_file" text,
        "header" jsonb,
        "column_map" jsonb,
        "received_at" timestamp DEFAULT now() NOT NULL,
        "status" text NOT NULL DEFAULT 'open',
        "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "purchasing_requests_outlet_idx" ON "purchasing_requests"("outlet_id")`,
    );
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "purchasing_request_lines" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "request_id" uuid NOT NULL REFERENCES "purchasing_requests"("id") ON DELETE CASCADE,
        "row_index" integer NOT NULL,
        "raw" jsonb,
        "their_code" text,
        "their_name" text NOT NULL,
        "ownership" text,
        "requested_qty" integer NOT NULL DEFAULT 0,
        "lwin18" text,
        "match_source" text,
        "match_score" double precision,
        "buckets" jsonb,
        "suggested_status" text,
        "suggested_note" text,
        "status" text,
        "note" text,
        "decided_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "decided_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "purchasing_request_lines_request_idx" ON "purchasing_request_lines"("request_id")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "purchasing_request_lines_lwin18_idx" ON "purchasing_request_lines"("lwin18")`,
    );
    console.log('✅ purchasing requests ready');

    /*
      Draft SO holds — a draft Zoho order's wine held while the client finishes
      it. Kept out of zoho_sales_orders, which everything reads as real orders.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "zoho_draft_holds" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "zoho_salesorder_id" text NOT NULL UNIQUE,
        "salesorder_number" text NOT NULL,
        "customer_name" text NOT NULL,
        "status" text NOT NULL DEFAULT 'active',
        "status_reason" text,
        "last_refreshed_at" timestamp,
        "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "zoho_draft_holds_status_idx" ON "zoho_draft_holds"("status")`);
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "zoho_draft_hold_lines" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "hold_id" uuid NOT NULL REFERENCES "zoho_draft_holds"("id") ON DELETE CASCADE,
        "zoho_line_item_id" text NOT NULL,
        "sku" text,
        "name" text NOT NULL,
        "description" text,
        "quantity" double precision NOT NULL,
        "unit" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "zoho_draft_hold_lines_hold_idx" ON "zoho_draft_hold_lines"("hold_id")`);
    console.log('✅ draft SO holds ready');

    /*
      PCO manual invoicing — per order line: delivered and waiting for a manual
      invoice, or invoiced against a number and date. Its own table so a missed
      run cannot break reads of order lines.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "pco_item_invoicing" (
        "item_id" uuid PRIMARY KEY REFERENCES "private_client_order_items"("id") ON DELETE CASCADE,
        "order_id" uuid NOT NULL REFERENCES "private_client_orders"("id") ON DELETE CASCADE,
        "status" text NOT NULL DEFAULT 'pending',
        "delivered_at" timestamp DEFAULT now() NOT NULL,
        "delivered_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "invoice_number" text,
        "invoice_date" timestamp,
        "invoiced_at" timestamp,
        "invoiced_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "pco_item_invoicing_order_idx" ON "pco_item_invoicing"("order_id")`);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "pco_item_invoicing_status_idx" ON "pco_item_invoicing"("status")`);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "pco_item_invoicing_number_idx" ON "pco_item_invoicing"("invoice_number")`);
    console.log('✅ PCO manual invoicing ready');

    // Private Cellar onboarding: membership pricing on the rate card
    await client.unsafe(`ALTER TABLE "cellar_release_rates" ADD COLUMN IF NOT EXISTS "membership_fee_aed" double precision NOT NULL DEFAULT 600`);
    await client.unsafe(`ALTER TABLE "cellar_release_rates" ADD COLUMN IF NOT EXISTS "included_cases" integer NOT NULL DEFAULT 20`);
    await client.unsafe(`ALTER TABLE "cellar_release_rates" ADD COLUMN IF NOT EXISTS "extra_case_monthly_aed" double precision NOT NULL DEFAULT 8`);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cellar_applications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "partner_id" uuid REFERENCES "partners"("id") ON DELETE SET NULL,
        "status" text DEFAULT 'draft' NOT NULL,
        "step" text DEFAULT 'about' NOT NULL,
        "full_name" text,
        "phone" text,
        "delivery_address" text,
        "eid_number" text,
        "eid_expiry" date,
        "terms_version" text,
        "terms_accepted_at" timestamp,
        "invite_id" uuid,
        "duplicate_of_partner_id" uuid REFERENCES "partners"("id") ON DELETE SET NULL,
        "submitted_at" timestamp,
        "decided_at" timestamp,
        "decided_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "decline_reason" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "cellar_applications_user_idx" ON "cellar_applications" ("user_id")`);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "cellar_applications_status_idx" ON "cellar_applications" ("status")`);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cellar_intakes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "application_id" uuid REFERENCES "cellar_applications"("id") ON DELETE CASCADE,
        "partner_id" uuid REFERENCES "partners"("id") ON DELETE CASCADE,
        "source" text NOT NULL,
        "holder_name" text,
        "holder_account_ref" text,
        "approx_cases" integer,
        "note" text,
        "tastes" text,
        "stage" text DEFAULT 'requested' NOT NULL,
        "shipment_id" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "cellar_intakes_partner_idx" ON "cellar_intakes" ("partner_id")`);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "cellar_intakes_application_idx" ON "cellar_intakes" ("application_id")`);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cellar_intake_files" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "intake_id" uuid NOT NULL REFERENCES "cellar_intakes"("id") ON DELETE CASCADE,
        "file_url" text NOT NULL,
        "file_name" text NOT NULL,
        "mime_type" text,
        "file_size" integer,
        "uploaded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "cellar_intake_files_intake_idx" ON "cellar_intake_files" ("intake_id")`);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cellar_memberships" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "partner_id" uuid NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
        "status" text DEFAULT 'not_activated' NOT NULL,
        "zoho_customer_id" text,
        "zoho_subscription_id" text,
        "zoho_hosted_page_id" text,
        "activated_at" timestamp,
        "activated_by" text,
        "card_last4" text,
        "next_billing_at" timestamp,
        "cancelled_at" timestamp,
        "last_extra_cases_pushed_for" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "cellar_memberships_partner_idx" ON "cellar_memberships" ("partner_id")`);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cellar_invites" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "email" text NOT NULL,
        "name" text NOT NULL,
        "phone" text,
        "token_hash" text NOT NULL,
        "status" text DEFAULT 'sent' NOT NULL,
        "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "partner_id" uuid REFERENCES "partners"("id") ON DELETE SET NULL,
        "invited_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "expires_at" timestamp NOT NULL,
        "last_sent_at" timestamp,
        "accepted_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "cellar_invites_token_idx" ON "cellar_invites" ("token_hash")`);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "cellar_invites_email_idx" ON "cellar_invites" ("email")`);
    console.log('✅ private cellar onboarding ready');

    /*
      Private Cellar storage re-priced to London +20% (Oct 2026): AED 8 per
      12-bottle case above the allowance, a 6-bottle case at half. Only cards
      still on the old AED 30 default move; a bespoke per-member price stays.
    */
    await client.unsafe(`ALTER TABLE "cellar_release_rates" ALTER COLUMN "extra_case_monthly_aed" SET DEFAULT 8`);
    await dataFix('cellar extra-case price AED 30 -> 8', async () => {
      await client`UPDATE "cellar_release_rates" SET "extra_case_monthly_aed" = 8 WHERE "extra_case_monthly_aed" = 30`;
    });
    console.log('✅ cellar storage re-priced');

    /*
      Where members pay for wine bought in bond (Oct 2026). Its own table so a
      missed migration can only blank the bank panel, never the rate card.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cellar_payment_settings" (
        "id" text PRIMARY KEY DEFAULT 'house' NOT NULL,
        "details" jsonb NOT NULL,
        "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('✅ cellar payment settings ready');

    /*
      LCB's prices at cost, by the date they took effect (Oct 2026): wine at
      our UK bond is charged under a UK rate card, separate from the UAE
      membership. Read behind a guard, so a missed run only blanks UK figures.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cellar_uk_rates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "effective_from" timestamp NOT NULL,
        "storage_per_unit_month_gbp" double precision DEFAULT 0 NOT NULL,
        "receive_per_case_gbp" double precision DEFAULT 0 NOT NULL,
        "handling_out_per_case_gbp" double precision DEFAULT 0 NOT NULL,
        "export_docs_per_move_gbp" double precision DEFAULT 0 NOT NULL,
        "notes" text,
        "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('✅ UK rate card ready');

    /*
      Purchases and memberships tell people when they move (Oct 2026). A
      value missing here only drops the notice — createNotification is always
      called inside a catch — never the purchase.
    */
    for (const value of ['cellar_purchase_update', 'cellar_membership_update']) {
      await client.unsafe(
        `ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }
    console.log('✅ cellar purchase and membership notifications ready');

    /*
      Wine in C&C's LCB Burton account, shown in members' cellars (Oct 2026).
      Separate tables, read behind a guard: a missed migration hides the UK
      section and nothing else.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cellar_uk_rotations" (
        "rotation" text PRIMARY KEY NOT NULL,
        "partner_id" uuid REFERENCES "partners"("id") ON DELETE SET NULL,
        "is_house" boolean DEFAULT false NOT NULL,
        "assigned_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "assigned_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cellar_uk_holdings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "rotation" text NOT NULL,
        "line" integer DEFAULT 0 NOT NULL,
        "lwin18" text NOT NULL,
        "brand" text,
        "description" text,
        "vintage" integer,
        "bottles_per_case" integer,
        "bottle_size_litres" double precision,
        "cases" integer DEFAULT 0 NOT NULL,
        "singles" integer DEFAULT 0 NOT NULL,
        "total_bottles" integer DEFAULT 0 NOT NULL,
        "packaging" text,
        "received_at" timestamp,
        "imported_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "cellar_uk_holdings_rotation_idx" ON "cellar_uk_holdings" ("rotation")`,
    );
    // Where the wine came from (Oct 2026): LCB's by-supplier report names the sender
    await client.unsafe(
      `ALTER TABLE "cellar_uk_holdings" ADD COLUMN IF NOT EXISTS "supplier_name" text`,
    );
    // The case's condition and its declared value, from the same report
    await client.unsafe(
      `ALTER TABLE "cellar_uk_holdings" ADD COLUMN IF NOT EXISTS "rotation_notes" text`,
    );
    await client.unsafe(
      `ALTER TABLE "cellar_uk_holdings" ADD COLUMN IF NOT EXISTS "gbp_value" double precision`,
    );
    console.log('✅ LCB UK holdings ready');

    /*
      A fixed reference per private cellar member, PC-1001 upwards (Oct 2026).
      Members quote it to the merchant or bond sending their wine to LCB, so a
      rotation can be traced back to them; the planned label codes use the
      same one. Its own table rather than a column on partners: every
      select() on partners would break if this ever failed to run.

      Existing members are numbered in the order they joined. Only active
      ones: closed and test records get a code the first time they need one.
    */
    await client.unsafe(
      `CREATE SEQUENCE IF NOT EXISTS "partner_client_code_seq" START 1001`,
    );
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "partner_client_codes" (
        "partner_id" uuid PRIMARY KEY NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
        "code" text NOT NULL UNIQUE,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`
      DO $$
      DECLARE member record;
      BEGIN
        FOR member IN
          SELECT p.id FROM partners p
          WHERE p.status = 'active'
            AND (p.type = 'private_collector'
              OR EXISTS (SELECT 1 FROM cellar_memberships m WHERE m.partner_id = p.id))
            AND NOT EXISTS (SELECT 1 FROM partner_client_codes c WHERE c.partner_id = p.id)
          ORDER BY p.created_at, p.id
        LOOP
          INSERT INTO partner_client_codes (partner_id, code)
          VALUES (member.id, 'PC-' || nextval('partner_client_code_seq'))
          ON CONFLICT (partner_id) DO NOTHING;
        END LOOP;
      END $$;
    `);
    console.log('✅ private cellar member references ready');

    /*
      Members moving wine from LCB Burton to the UAE (Oct 2026). Read behind a
      guard, so a missed migration hides the move option and nothing else.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cellar_uk_moves" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "move_number" text NOT NULL UNIQUE,
        "partner_id" uuid NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
        "status" text DEFAULT 'submitted' NOT NULL,
        "member_notes" text,
        "admin_notes" text,
        "freight_usd" double precision,
        "lcb_charges_usd" double precision,
        "other_usd" double precision,
        "other_label" text,
        "total_usd" double precision,
        "quoted_at" timestamp,
        "quoted_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "accepted_at" timestamp,
        "shipment_id" uuid REFERENCES "logistics_shipments"("id") ON DELETE SET NULL,
        "shipped_at" timestamp,
        "closed_at" timestamp,
        "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "cellar_uk_moves_partner_idx" ON "cellar_uk_moves" ("partner_id")`,
    );
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cellar_uk_move_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "move_id" uuid NOT NULL REFERENCES "cellar_uk_moves"("id") ON DELETE CASCADE,
        "rotation" text NOT NULL,
        "line" integer DEFAULT 0 NOT NULL,
        "lwin18" text NOT NULL,
        "name" text NOT NULL,
        "vintage" integer,
        "bottles_per_case" integer,
        "bottle_size_litres" double precision,
        "cases" integer DEFAULT 0 NOT NULL,
        "singles" integer DEFAULT 0 NOT NULL,
        "total_bottles" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "cellar_uk_move_items_move_idx" ON "cellar_uk_move_items" ("move_id")`,
    );
    console.log('✅ UK to UAE moves ready');

    /*
      Delivery improvements (Oct 2026): a member's saved addresses, and how
      they would like each delivery made — a preferred day, a gift recipient.
      Both read behind a guard.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cellar_delivery_addresses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "partner_id" uuid NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
        "label" text NOT NULL,
        "address" text NOT NULL,
        "instructions" text,
        "is_default" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "cellar_delivery_addresses_partner_idx" ON "cellar_delivery_addresses" ("partner_id")`,
    );
    // The address a member already saved becomes their default. Idempotent:
    // only members with no saved addresses yet.
    await client.unsafe(`
      INSERT INTO "cellar_delivery_addresses" ("partner_id", "label", "address", "instructions", "is_default")
      SELECT p."id", 'Home', btrim(p."delivery_address"), p."delivery_instructions", true
      FROM "partners" p
      WHERE p."type" = 'private_collector'
        AND p."delivery_address" IS NOT NULL
        AND btrim(p."delivery_address") <> ''
        AND NOT EXISTS (
          SELECT 1 FROM "cellar_delivery_addresses" a WHERE a."partner_id" = p."id"
        )
    `);
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cellar_release_delivery_details" (
        "request_id" uuid PRIMARY KEY NOT NULL REFERENCES "cellar_release_requests"("id") ON DELETE CASCADE,
        "address_id" uuid REFERENCES "cellar_delivery_addresses"("id") ON DELETE SET NULL,
        "address_label" text,
        "delivery_instructions" text,
        "preferred_date" date,
        "preferred_window" text,
        "is_gift" boolean DEFAULT false NOT NULL,
        "recipient_name" text,
        "recipient_phone" text,
        "gift_message" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('✅ delivery addresses and delivery preferences ready');

    /*
      Wines members ask us to find, and allocations offered to members first
      (Oct 2026). Read behind a guard: a missed migration hides those panels
      and nothing else.
    */
    for (const value of ['cellar_sourcing_update', 'cellar_allocation_update']) {
      await client.unsafe(
        `ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cellar_sourcing_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "request_number" text NOT NULL UNIQUE,
        "partner_id" uuid NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
        "lwin" text,
        "wine_name" text NOT NULL,
        "vintages" text,
        "bottles" integer NOT NULL,
        "format" text,
        "budget_per_bottle_usd" double precision,
        "hold_at" text DEFAULT 'uae' NOT NULL,
        "notes" text,
        "status" text DEFAULT 'requested' NOT NULL,
        "staff_note" text,
        "offer_lwin18" text,
        "offer_wine_name" text,
        "offer_vintage" integer,
        "offer_case_config" integer,
        "offer_cases" integer,
        "offer_price_per_bottle_usd" double precision,
        "offer_hold_at" text,
        "offer_valid_until" timestamp,
        "offer_note" text,
        "offer_from_stock" boolean DEFAULT false NOT NULL,
        "offered_at" timestamp,
        "offered_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "responded_at" timestamp,
        "purchase_id" uuid,
        "task_id" uuid,
        "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "cellar_sourcing_requests_partner_idx" ON "cellar_sourcing_requests" ("partner_id")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "cellar_sourcing_requests_status_idx" ON "cellar_sourcing_requests" ("status")`,
    );
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cellar_allocations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "lwin18" text,
        "wine_name" text NOT NULL,
        "producer" text,
        "vintage" integer,
        "format" text,
        "case_config" integer DEFAULT 6 NOT NULL,
        "price_per_bottle_usd" double precision NOT NULL,
        "total_cases" integer NOT NULL,
        "max_cases_per_member" integer,
        "closes_at" timestamp,
        "delivery_note" text,
        "description" text,
        "hold_at" text DEFAULT 'uae' NOT NULL,
        "from_stock" boolean DEFAULT false NOT NULL,
        "status" text DEFAULT 'open' NOT NULL,
        "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "cellar_allocations_status_idx" ON "cellar_allocations" ("status")`,
    );
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cellar_allocation_interests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "allocation_id" uuid NOT NULL REFERENCES "cellar_allocations"("id") ON DELETE CASCADE,
        "partner_id" uuid NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
        "cases_requested" integer NOT NULL,
        "cases_allocated" integer,
        "status" text DEFAULT 'interested' NOT NULL,
        "responded_at" timestamp,
        "purchase_id" uuid,
        "task_id" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "cellar_allocation_interests_member_idx" ON "cellar_allocation_interests" ("allocation_id", "partner_id")`,
    );
    console.log('✅ cellar sourcing requests and allocations ready');

    /*
      Shared access to a cellar (Oct 2026): a spouse or PA, as viewer or
      manager. Read behind a guard that treats a missing table as "nobody
      shares a cellar", which is exactly true until this has run.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "cellar_access_grants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "partner_id" uuid NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
        "email" text NOT NULL,
        "name" text NOT NULL,
        "role" text NOT NULL,
        "status" text DEFAULT 'invited' NOT NULL,
        "token_hash" text NOT NULL,
        "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "invited_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "expires_at" timestamp NOT NULL,
        "accepted_at" timestamp,
        "approved_on_accept" boolean DEFAULT false NOT NULL,
        "revoked_at" timestamp,
        "revoked_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "cellar_access_grants_token_idx" ON "cellar_access_grants" ("token_hash")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "cellar_access_grants_partner_idx" ON "cellar_access_grants" ("partner_id")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "cellar_access_grants_user_idx" ON "cellar_access_grants" ("user_id")`,
    );
    await client.unsafe(
      `ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'cellar_access_update'`,
    );
    console.log('✅ shared cellar access ready');

    /*
      An order's paperwork, checked as a set.

      The client's LPO is kept with the sales order it led to, so the order can
      be checked again whenever Zoho changes, and who signed the check off is
      recorded. The LPO is stored as read (header and lines), not as the file.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "order_check_files" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "so_number" text NOT NULL,
        "customer_name" text,
        "lpo_number" text,
        "lpo" jsonb,
        "lpo_read_by" text,
        "lpo_file_name" text,
        "attached_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "attached_at" timestamp,
        "last_status" text,
        "last_counts" jsonb,
        "last_checked_at" timestamp,
        "signed_off_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "signed_off_at" timestamp,
        "signed_off_status" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "order_check_files_so_idx" ON "order_check_files" ("so_number")`,
    );
    console.log('✅ order_check_files ready');

    /*
      Sign-in rate limits, shared by every server. Kept per server in memory
      they multiplied by the number of servers Vercel happened to be running.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "auth_rate_limits" (
        "key" text PRIMARY KEY,
        "count" integer NOT NULL,
        "last_request" bigint NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "auth_rate_limits_last_request_idx" ON "auth_rate_limits" ("last_request")`,
    );
    console.log('✅ auth_rate_limits ready');

    /*
      Freight quotes: forwarders on file, who each request went to, the
      forwarder's own document, and prices that rank across currencies.

      Forwarders are seeded from the names already typed on quotes, so the
      list starts with everyone who has ever quoted, and existing quotes are
      linked to them by exact name.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "logistics_forwarders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" text NOT NULL UNIQUE,
        "email_domains" text[] DEFAULT '{}'::text[] NOT NULL,
        "contacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "logistics_forwarders_active_idx" ON "logistics_forwarders" ("is_active")`,
    );

    for (const ddl of [
      `ALTER TABLE "logistics_quotes" ADD COLUMN IF NOT EXISTS "forwarder_id" uuid REFERENCES "logistics_forwarders"("id") ON DELETE SET NULL`,
      `ALTER TABLE "logistics_quotes" ADD COLUMN IF NOT EXISTS "forwarder_reference" text`,
      `ALTER TABLE "logistics_quotes" ADD COLUMN IF NOT EXISTS "total_usd" double precision`,
      `ALTER TABLE "logistics_quotes" ADD COLUMN IF NOT EXISTS "fx_to_usd" double precision`,
      `ALTER TABLE "logistics_quote_requests" ADD COLUMN IF NOT EXISTS "total_bottles" integer`,
      `ALTER TABLE "logistics_quote_requests" ADD COLUMN IF NOT EXISTS "total_75cl_equivalents" double precision`,
      `ALTER TABLE "logistics_quote_requests" ADD COLUMN IF NOT EXISTS "source_type" text`,
      `ALTER TABLE "logistics_quote_requests" ADD COLUMN IF NOT EXISTS "source_id" uuid`,
      `ALTER TABLE "logistics_quote_requests" ADD COLUMN IF NOT EXISTS "reply_by" timestamp`,
      `ALTER TABLE "logistics_quote_requests" ADD COLUMN IF NOT EXISTS "client_price_usd" double precision`,
      `ALTER TABLE "logistics_quote_requests" ADD COLUMN IF NOT EXISTS "client_quote_id" uuid`,
      `ALTER TABLE "logistics_quote_requests" ADD COLUMN IF NOT EXISTS "client_quoted_at" timestamp`,
      `ALTER TABLE "logistics_shipments" ADD COLUMN IF NOT EXISTS "client_price_usd" double precision`,
      `ALTER TABLE "logistics_shipments" ADD COLUMN IF NOT EXISTS "quoted_margin_usd" double precision`,
      `ALTER TABLE "logistics_quote_requests" ADD COLUMN IF NOT EXISTS "shipment_id" uuid REFERENCES "logistics_shipments"("id") ON DELETE SET NULL`,
      `ALTER TABLE "logistics_quote_requests" ADD COLUMN IF NOT EXISTS "client_name" text`,
      `ALTER TABLE "logistics_quote_requests" ADD COLUMN IF NOT EXISTS "client_email" text`,
    ]) {
      await client.unsafe(ddl);
    }
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "logistics_quote_requests_shipment_id_idx" ON "logistics_quote_requests" ("shipment_id")`,
    );
    // A request started from a shipment is quoted for that shipment's job
    await client.unsafe(`
      UPDATE "logistics_quote_requests" r SET "shipment_id" = r."source_id"
      WHERE r."shipment_id" IS NULL AND r."source_type" = 'shipment'
        AND EXISTS (SELECT 1 FROM "logistics_shipments" s WHERE s."id" = r."source_id")
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "logistics_quotes_forwarder_id_idx" ON "logistics_quotes" ("forwarder_id")`,
    );

    // A quote's request id was never a foreign key; clear any that point nowhere, then make it one
    await client.unsafe(`
      UPDATE "logistics_quotes" SET "request_id" = NULL
      WHERE "request_id" IS NOT NULL
        AND "request_id" NOT IN (SELECT "id" FROM "logistics_quote_requests")
    `);
    await client.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'logistics_quotes_request_id_fk'
        ) THEN
          ALTER TABLE "logistics_quotes"
            ADD CONSTRAINT "logistics_quotes_request_id_fk"
            FOREIGN KEY ("request_id") REFERENCES "logistics_quote_requests"("id") ON DELETE SET NULL;
        END IF;
      END $$
    `);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "logistics_quote_request_recipients" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "request_id" uuid NOT NULL REFERENCES "logistics_quote_requests"("id") ON DELETE CASCADE,
        "forwarder_id" uuid NOT NULL REFERENCES "logistics_forwarders"("id") ON DELETE CASCADE,
        "sent_at" timestamp,
        "sent_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "chased_at" timestamp,
        "outcome" text DEFAULT 'awaiting' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "logistics_quote_request_recipients_unique_idx" ON "logistics_quote_request_recipients" ("request_id", "forwarder_id")`,
    );

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "logistics_quote_attachments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "quote_id" uuid NOT NULL REFERENCES "logistics_quotes"("id") ON DELETE CASCADE,
        "file_name" text NOT NULL,
        "file_url" text NOT NULL,
        "file_size" integer,
        "mime_type" text,
        "uploaded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "logistics_quote_attachments_quote_id_idx" ON "logistics_quote_attachments" ("quote_id")`,
    );

    // Everyone who has quoted becomes a forwarder on file, with their email as a contact
    await client.unsafe(`
      INSERT INTO "logistics_forwarders" ("name", "email_domains", "contacts")
      SELECT
        trim(q."forwarder_name"),
        COALESCE(array_agg(DISTINCT lower(split_part(q."forwarder_email", '@', 2)))
          FILTER (WHERE q."forwarder_email" LIKE '%@%'), '{}'::text[]),
        COALESCE(jsonb_agg(DISTINCT jsonb_build_object('email', lower(q."forwarder_email")))
          FILTER (WHERE q."forwarder_email" LIKE '%@%'), '[]'::jsonb)
      FROM "logistics_quotes" q
      WHERE trim(q."forwarder_name") <> ''
      GROUP BY trim(q."forwarder_name")
      ON CONFLICT ("name") DO NOTHING
    `);
    await client.unsafe(`
      UPDATE "logistics_quotes" q SET "forwarder_id" = f."id"
      FROM "logistics_forwarders" f
      WHERE q."forwarder_id" IS NULL AND trim(q."forwarder_name") = f."name"
    `);

    // Dollar and dollar-pegged quotes convert at a fixed rate; anything else is set when next saved
    await client.unsafe(`
      UPDATE "logistics_quotes" SET
        "fx_to_usd" = CASE upper("currency")
          WHEN 'USD' THEN 1 WHEN 'AED' THEN 0.2723 WHEN 'SAR' THEN 0.2667
          WHEN 'QAR' THEN 0.2747 WHEN 'BHD' THEN 2.6539 WHEN 'OMR' THEN 2.6008 END,
        "total_usd" = round(("total_price" * CASE upper("currency")
          WHEN 'USD' THEN 1 WHEN 'AED' THEN 0.2723 WHEN 'SAR' THEN 0.2667
          WHEN 'QAR' THEN 0.2747 WHEN 'BHD' THEN 2.6539 WHEN 'OMR' THEN 2.6008 END)::numeric, 2)
      WHERE "total_usd" IS NULL
        AND upper("currency") IN ('USD', 'AED', 'SAR', 'QAR', 'BHD', 'OMR')
    `);
    console.log('✅ freight quote forwarders, recipients and attachments ready');

    // Freight emails sent from logistics@, one row per forwarder emailed
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "logistics_quote_emails" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "request_id" uuid NOT NULL REFERENCES "logistics_quote_requests"("id") ON DELETE CASCADE,
        "forwarder_id" uuid REFERENCES "logistics_forwarders"("id") ON DELETE SET NULL,
        "quote_id" uuid REFERENCES "logistics_quotes"("id") ON DELETE SET NULL,
        "kind" text NOT NULL,
        "to_emails" text[] NOT NULL,
        "cc_emails" text[] DEFAULT '{}'::text[] NOT NULL,
        "subject" text NOT NULL,
        "body" text NOT NULL,
        "status" text NOT NULL,
        "error" text,
        "sent_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "logistics_quote_emails_request_id_idx" ON "logistics_quote_emails" ("request_id")`,
    );
    console.log('✅ logistics_quote_emails ready');

    // What each forwarder covers, so a new route can suggest it
    for (const ddl of [
      `ALTER TABLE "logistics_forwarders" ADD COLUMN IF NOT EXISTS "modes" text[] DEFAULT '{}'::text[] NOT NULL`,
      `ALTER TABLE "logistics_forwarders" ADD COLUMN IF NOT EXISTS "origin_countries" text[] DEFAULT '{}'::text[] NOT NULL`,
      `ALTER TABLE "logistics_forwarders" ADD COLUMN IF NOT EXISTS "notes" text`,
    ]) {
      await client.unsafe(ddl);
    }
    console.log('✅ forwarder coverage ready');

    /*
      Wine Labs market data (Oct 2026). One row per wine and vintage (LWIN11)
      so every screen reads the same cached answer and a credit is spent once,
      plus a log of each call so a month's spend can be capped.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "winelabs_wines" (
        "lwin11" text PRIMARY KEY NOT NULL,
        "our_lwin7" text NOT NULL,
        "our_name" text NOT NULL,
        "match_status" text NOT NULL,
        "wl_lwin7" text,
        "wl_lwin" text,
        "wl_id" text,
        "wl_display_name" text,
        "info" jsonb,
        "drink_from" integer,
        "drink_to" integer,
        "info_fetched_at" timestamp,
        "price" jsonb,
        "price_median_usd" double precision,
        "price_count" integer,
        "price_fetched_at" timestamp,
        "matched_at" timestamp DEFAULT now() NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "winelabs_calls" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "endpoint" text NOT NULL,
        "credits" integer NOT NULL,
        "status" integer NOT NULL,
        "error" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "winelabs_calls_created_at_idx" ON "winelabs_calls" ("created_at")`,
    );
    console.log('✅ winelabs cache ready');

    /*
      One owner key (Index 3.0, Oct 2026). The distribution ledger's owners
      (cons_owners) were seeded with no partner account, so their consignment
      sales could reach no portal. Link each to the partner whose warehouse
      stock its name matches, only where exactly one partner matches; anything
      ambiguous is left for staff to link on the Distribution page.
    */
    /*
      Whose bottles left (Index 3.0, Oct 2026). Picks and dispatches recorded
      no owner and no stock row, so a bottle that left the warehouse vanished
      from its owner's statement. Additive, nullable, no foreign keys.
    */
    for (const ddl of [
      `ALTER TABLE "wms_stock_movements" ADD COLUMN IF NOT EXISTS "stock_id" uuid`,
      `ALTER TABLE "wms_pick_list_items" ADD COLUMN IF NOT EXISTS "picked_stock_id" uuid`,
      `CREATE INDEX IF NOT EXISTS "wms_stock_movements_order_id_idx" ON "wms_stock_movements" ("order_id")`,
      `CREATE INDEX IF NOT EXISTS "wms_stock_movements_from_owner_idx" ON "wms_stock_movements" ("from_owner_id")`,
    ]) {
      await client.unsafe(ddl);
    }
    console.log('✅ movements carry owner and stock row');

    /*
      Take out of stock with a reason (Index 3.0, Oct 2026). Every bottle
      removed by hand (samples, marketing, breakage, loss, collected, sold
      outside Zoho) gets one row here beside its movement, so the owner's
      statement can say where it went and how it is settled. Its own table,
      so a missed migration cannot break reads of the movements themselves.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "wms_stock_outflows" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "movement_id" uuid NOT NULL,
        "stock_id" uuid NOT NULL,
        "owner_id" uuid NOT NULL,
        "lwin18" text NOT NULL,
        "product_name" text NOT NULL,
        "bottles" integer NOT NULL,
        "reason" text NOT NULL,
        "settlement" text NOT NULL,
        "recipient" text,
        "note" text,
        "unit_price_usd" double precision,
        "reference" text,
        "backdated" boolean DEFAULT false NOT NULL,
        "performed_by" uuid NOT NULL,
        "performed_at" timestamp DEFAULT now() NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "wms_stock_outflows_owner_idx" ON "wms_stock_outflows" ("owner_id", "performed_at")`);
    console.log('✅ stock outflows ready');

    /*
      What kind of order a PCO is (Index 3.0, Oct 2026). Every outbound
      request runs through the PCO pipeline; the kind decides what the
      bottles become on the owner's statement: client_sale (sold to a private
      client), owner_delivery (a cellar member's own wine delivered to them,
      not a sale), partner_samples, cellar_sale.
    */
    await client.unsafe(
      `ALTER TABLE "private_client_orders" ADD COLUMN IF NOT EXISTS "order_kind" text DEFAULT 'client_sale' NOT NULL`,
    );
    await dataFix('cellar deliveries marked as owner deliveries', async () => {
      await client.unsafe(`
        UPDATE "private_client_orders" o SET "order_kind" = 'owner_delivery'
        FROM "cellar_release_requests" r
        WHERE r."private_client_order_id" = o."id" AND o."order_kind" = 'client_sale'
      `);
    });
    console.log('✅ PCO order kinds ready');

    /*
      Zoho invoice lines (Index 3.0, Oct 2026). Invoices were stored without
      their lines and linked to sales orders by a text number, so nothing tied
      a bottle that left to the invoice line it was billed on. Lines are
      fetched by the invoice sync when an invoice is new or changed; the sync
      marker lives in its own table so zoho_invoices itself is untouched.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "zoho_invoice_line_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "zoho_invoice_id" text NOT NULL,
        "invoice_number" text NOT NULL,
        "zoho_line_item_id" text,
        "line_order" integer NOT NULL,
        "item_type" text,
        "zoho_item_id" text,
        "sku" text,
        "name" text NOT NULL,
        "quantity" double precision NOT NULL,
        "unit" text,
        "rate" double precision NOT NULL,
        "item_total" double precision,
        "zoho_salesorder_id" text,
        "zoho_salesorder_item_id" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "zoho_invoice_line_items_invoice_idx" ON "zoho_invoice_line_items" ("zoho_invoice_id")`);
    await client.unsafe(`CREATE INDEX IF NOT EXISTS "zoho_invoice_line_items_sku_idx" ON "zoho_invoice_line_items" ("sku")`);
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "zoho_invoice_line_sync" (
        "zoho_invoice_id" text PRIMARY KEY NOT NULL,
        "last_modified" text,
        "zoho_salesorder_id" text,
        "zoho_salesorder_number" text,
        "synced_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('✅ zoho invoice lines ready');

    /*
      Whose bottles left, for movements written before picks recorded it
      (Index 3.0, 25 Oct 2026). Ihab Toma's October statement showed nothing
      leaving while 75 of his bottles were picked for trade orders: picks
      carried a bay but no owner. Where exactly one owner has ever held that
      wine in that bay (zero-quantity rows included), the movement is stamped
      with that owner and marked inferred; anything ambiguous is left for an
      operator. Outflows only: picks, and count / adjust decreases.
    */
    await client.unsafe(
      `ALTER TABLE "wms_stock_movements" ADD COLUMN IF NOT EXISTS "owner_inferred" boolean DEFAULT false NOT NULL`,
    );
    await dataFix('past outflows stamped with the owner of the bay they left', async () => {
      await client.unsafe(`
        UPDATE "wms_stock_movements" m
        SET "from_owner_id" = s.owner_id, "owner_inferred" = true
        FROM (
          SELECT "lwin18", "location_id", MIN("owner_id"::text)::uuid AS owner_id
          FROM "wms_stock"
          GROUP BY "lwin18", "location_id"
          HAVING COUNT(DISTINCT "owner_id") = 1
        ) s
        WHERE m."from_owner_id" IS NULL
          AND m."from_location_id" IS NOT NULL
          AND m."movement_type" IN ('pick', 'count', 'adjust')
          AND m."lwin18" = s."lwin18"
          AND m."from_location_id" = s."location_id"
      `);
    });

    /*
      The past-outflow backfill read today's bay owner. Where ownership of that
      wine in that bay changed after the movement, today's owner is not who
      held it then, so the guess is withdrawn (owner unknown beats the wrong
      owner on a statement). Count and adjust increases were never outflows.
    */
    await dataFix('inferred owners withdrawn where the bay changed hands later', async () => {
      await client.unsafe(`
        UPDATE "wms_stock_movements" m
        SET "from_owner_id" = NULL, "owner_inferred" = false
        WHERE m."owner_inferred" = true
          AND (
            (m."movement_type" IN ('count', 'adjust') AND m."quantity_cases" >= 0 AND COALESCE(m."reason_code", '') NOT LIKE 'stock_out:%')
            OR EXISTS (
              SELECT 1 FROM "wms_stock_movements" t
              WHERE t."movement_type" = 'ownership_transfer'
                AND t."lwin18" = m."lwin18"
                AND (t."from_location_id" = m."from_location_id" OR t."to_location_id" = m."from_location_id")
                AND t."performed_at" > m."performed_at"
            )
          )
      `);
    });

    // Take-outs written positive before 25 Oct: removals are negative everywhere else
    await dataFix('take-out movements recorded as removals', async () => {
      await client.unsafe(`
        UPDATE "wms_stock_movements"
        SET "quantity_cases" = -"quantity_cases", "quantity_bottles" = -"quantity_bottles"
        WHERE "reason_code" LIKE 'stock_out:%' AND "quantity_cases" >= 0 AND "quantity_bottles" > 0
      `);
    });

    /*
      The private client order a Zoho sales order fulfils (25 Oct 2026). The
      only link was the PCO number typed into the SO's Reference, read as text
      wherever it mattered: SO-00225, Ihab Toma's own delivery, read as a sale
      to City Drinks. Filled by the Zoho sync (linkSalesOrdersToPcos), which
      also fills past orders on its first run.
    */
    await client.unsafe(
      `ALTER TABLE "zoho_sales_orders" ADD COLUMN IF NOT EXISTS "private_client_order_id" uuid`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "zoho_sales_orders_pco_idx" ON "zoho_sales_orders" ("private_client_order_id")`,
    );

    await dataFix('consignment owners linked to their partner accounts', async () => {
      await client.unsafe(`
        UPDATE "cons_owners" ow
        SET "partner_id" = m."owner_id", "updated_at" = now()
        FROM (
          SELECT ow2."id" AS cons_id, MIN(s."owner_id"::text)::uuid AS owner_id
          FROM "cons_owners" ow2
          JOIN "wms_stock" s
            ON ow2."wms_owner_match" IS NOT NULL
           AND UPPER(s."owner_name") LIKE '%' || UPPER(ow2."wms_owner_match") || '%'
          WHERE ow2."partner_id" IS NULL
          GROUP BY ow2."id"
          HAVING COUNT(DISTINCT s."owner_id") = 1
        ) m
        WHERE ow."id" = m.cons_id
          AND ow."partner_id" IS NULL
          AND NOT EXISTS (SELECT 1 FROM "cons_owners" o3 WHERE o3."partner_id" = m."owner_id")
      `);
    });

    /*
      The currency a member set their asking price in (26 Oct 2026). USD stays
      the base; a price typed in EUR, GBP or AED is converted at the rate on
      the day it was listed and that rate is kept, so a later move in the
      exchange rate never changes what the member was promised.
    */
    for (const [column, type] of [
      ['ask_currency', `text DEFAULT 'USD' NOT NULL`],
      ['ask_per_bottle_local', 'double precision'],
      ['ask_fx_rate', 'double precision'],
      ['ask_fx_at', 'timestamp'],
    ]) {
      await client.unsafe(
        `ALTER TABLE "sale_mandates" ADD COLUMN IF NOT EXISTS "${column}" ${type}`,
      );
    }
    console.log('✅ Sale mandate asking currency ready');

    /*
      What's New for members (26 Oct 2026). Updates are drafted by the AI from
      each release and published by staff; a member's last visit is one
      timestamp on their user, which is all "new since your last visit" needs.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "product_updates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "type" text NOT NULL,
        "audiences" text[] DEFAULT '{}'::text[] NOT NULL,
        "title" text NOT NULL,
        "body" text DEFAULT '' NOT NULL,
        "link_path" text,
        "status" text DEFAULT 'draft' NOT NULL,
        "published_at" timestamp,
        "release_version" text,
        "source_ref" text UNIQUE,
        "source_text" text,
        "skipped_reason" text,
        "created_by" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`ALTER TABLE "product_updates" ENABLE ROW LEVEL SECURITY`);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "product_updates_status_idx" ON "product_updates" ("status", "published_at")`,
    );
    await client.unsafe(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "whats_new_seen_at" timestamp`,
    );
    console.log('✅ What\'s New ready');

    /*
      Private Cellar member emails (26 Oct 2026). Every member email is queued
      here first and sent by the member-emails cron in the switch's mode (off,
      shadow or live), so nothing reaches a member until Kevin turns it on.
    */
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "member_email_outbox" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "dedupe_key" text NOT NULL UNIQUE,
        "kind" text NOT NULL,
        "entity_id" text NOT NULL,
        "partner_id" uuid,
        "recipient_user_id" uuid,
        "recipient_email" text NOT NULL,
        "recipient_name" text NOT NULL,
        "template" text NOT NULL,
        "data" jsonb NOT NULL,
        "is_action" boolean DEFAULT false NOT NULL,
        "is_mergeable" boolean DEFAULT false NOT NULL,
        "send_at" timestamp NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "merged_into" uuid,
        "sent_mode" text,
        "sent_to" text,
        "sent_at" timestamp,
        "error" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    await client.unsafe(`ALTER TABLE "member_email_outbox" ENABLE ROW LEVEL SECURITY`);
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "member_email_outbox_due_idx" ON "member_email_outbox" ("status", "send_at")`,
    );
    await client.unsafe(
      `CREATE INDEX IF NOT EXISTS "member_email_outbox_recipient_idx" ON "member_email_outbox" ("recipient_user_id", "send_at")`,
    );
    console.log('✅ Member email outbox ready');

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await client.end();
    process.exit(1);
  }
};

runMigrations();
