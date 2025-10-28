import 'dotenv/config';

import type { Config } from 'drizzle-kit';

export default {
  schema: './src/database/schema.ts',
  out: './src/database',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DB_URL!,
  },
} satisfies Config;
