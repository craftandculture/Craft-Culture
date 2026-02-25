import { sql } from 'drizzle-orm';

import db from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Check database connectivity by executing a simple query
 * and measuring response time.
 *
 * @returns Database health status with latency in milliseconds
 */
const adminHealthCheckDb = adminProcedure.query(async () => {
  const start = performance.now();

  try {
    await db.execute(sql`SELECT 1 AS ok`);
    const latencyMs = Math.round(performance.now() - start);

    return {
      status: 'connected' as const,
      latencyMs,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);

    return {
      status: 'error' as const,
      latencyMs,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
});

export default adminHealthCheckDb;
