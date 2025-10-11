import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import serverConfig from '@/server.config';

import relations from './relations';

export const client = postgres(serverConfig.dbUrl, {
  prepare: false,
});

const db = drizzle(client, {
  logger: false,
  relations,
});

export default db;
