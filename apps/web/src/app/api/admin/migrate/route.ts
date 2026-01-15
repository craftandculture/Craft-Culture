import { readFileSync } from 'fs';
import { join } from 'path';

import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import db from '@/database/client';
import { getUserOrRedirect } from '@/lib/auth/getUserOrRedirect';

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

    // Check if source_customer_pos table exists
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'source_customer_pos'
      ) as exists
    `);

    if (tableCheck.rows[0]?.exists) {
      return NextResponse.json({
        success: true,
        message: 'Tables already exist, no migration needed',
      });
    }

    // Read the migration file
    const migrationPath = join(process.cwd(), 'src/database/0015_parched_winter_soldier.sql');
    const migrationSql = readFileSync(migrationPath, 'utf-8');

    // Split by statement breakpoint and execute each statement
    const statements = migrationSql.split('--> statement-breakpoint');
    const results: string[] = [];

    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed) {
        try {
          await db.execute(sql.raw(trimmed));
          results.push(`✅ ${trimmed.substring(0, 60)}...`);
        } catch (err) {
          const error = err as Error;
          // Ignore "already exists" errors
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

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 }
    );
  }
}
