#!/usr/bin/env node
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const runMigrations = async () => {
  const dbUrl = process.env.DB_URL;

  if (!dbUrl) {
    console.error('❌ DB_URL environment variable is not set');
    process.exit(1);
  }

  console.log('🔄 Running database migrations...');

  const client = postgres(dbUrl, { max: 1 });
  const db = drizzle(client);

  try {
    await migrate(db, { migrationsFolder: './src/database' });
    console.log('✅ Migrations completed successfully');
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await client.end();
    process.exit(1);
  }
};

runMigrations();
