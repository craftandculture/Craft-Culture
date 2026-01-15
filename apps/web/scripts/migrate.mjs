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

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await client.end();
    process.exit(1);
  }
};

runMigrations();
