import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import relations from '@/database/relations';

/**
 * Lightweight database client for Trigger.dev jobs
 *
 * This avoids importing server.env.ts which validates ALL env vars at import time.
 * Trigger jobs only need DB_URL which is validated here.
 */
const getDbUrl = () => {
  const url = process.env.DB_URL;
  if (!url) {
    throw new Error('DB_URL environment variable is required');
  }
  return url;
};

export const triggerClient = postgres(getDbUrl(), {
  prepare: false,
});

const triggerDb = drizzle(triggerClient, {
  logger: false,
  relations,
});

export default triggerDb;
