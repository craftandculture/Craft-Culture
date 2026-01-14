#!/usr/bin/env node
import postgres from 'postgres';

const runMigrations = async () => {
  const dbUrl = process.env.DB_URL;

  if (!dbUrl) {
    console.log('⚠️ DB_URL not available, skipping migrations (this is expected during build)');
    process.exit(0);
  }

  console.log('🔄 Adding local_inventory to product_source enum...');

  const client = postgres(dbUrl, { max: 1 });

  try {
    // Check if the enum value already exists
    const result = await client`
      SELECT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'local_inventory'
        AND enumtypid = (
          SELECT oid FROM pg_type WHERE typname = 'product_source'
        )
      ) as exists
    `;

    if (result[0].exists) {
      console.log('✅ local_inventory enum value already exists, skipping');
    } else {
      // Add the new enum value
      await client.unsafe(`ALTER TYPE "public"."product_source" ADD VALUE 'local_inventory'`);
      console.log('✅ Successfully added local_inventory enum value');
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
