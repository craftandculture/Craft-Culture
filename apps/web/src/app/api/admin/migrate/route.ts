import { readFileSync } from 'fs';
import { join } from 'path';

import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import getUserOrRedirect from '@/app/_auth/data/getUserOrRedirect';
import db from '@/database/client';

/**
 * Run a migration file
 */
const runMigration = async (migrationPath: string, moduleName: string) => {
  const migrationSql = readFileSync(migrationPath, 'utf-8');
  const statements = migrationSql.split('--> statement-breakpoint');
  const results: string[] = [];

  for (const statement of statements) {
    const trimmed = statement.trim();
    if (trimmed) {
      try {
        await db.execute(sql`${sql.raw(trimmed)}`);
        results.push(`✅ ${trimmed.substring(0, 60)}...`);
      } catch (err) {
        const error = err as Error;
        if (
          !error.message.includes('already exists') &&
          !error.message.includes('duplicate key')
        ) {
          results.push(`❌ ${trimmed.substring(0, 60)}... - ${error.message}`);
        } else {
          results.push(`⏭️ Skipped: ${trimmed.substring(0, 60)}...`);
        }
      }
    }
  }

  return { module: moduleName, results };
};

/**
 * Admin endpoint to run database migrations
 * POST /api/admin/migrate
 */
export async function POST() {
  try {
    // Verify admin user
    const user = await getUserOrRedirect();
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const allResults: { module: string; results: string[] }[] = [];

    // Check and run SOURCE module migration
    const sourceCheck = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'source_customer_pos'
      ) as exists
    `);

    if (!sourceCheck[0]?.exists) {
      const sourcePath = join(process.cwd(), 'src/database/0015_parched_winter_soldier.sql');
      allResults.push(await runMigration(sourcePath, 'SOURCE'));
    } else {
      allResults.push({ module: 'SOURCE', results: ['⏭️ Tables already exist'] });
    }

    // Check and run LOGISTICS module migration
    const logisticsCheck = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'logistics_shipments'
      ) as exists
    `);

    if (!logisticsCheck[0]?.exists) {
      const logisticsPath = join(process.cwd(), 'src/database/0016_mysterious_silhouette.sql');
      allResults.push(await runMigration(logisticsPath, 'LOGISTICS'));
    } else {
      allResults.push({ module: 'LOGISTICS', results: ['⏭️ Tables already exist'] });
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results: allResults,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 }
    );
  }
}
