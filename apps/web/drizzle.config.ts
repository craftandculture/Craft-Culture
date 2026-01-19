import { config } from 'dotenv';
import type { Config } from 'drizzle-kit';

config({ path: '.env.local' });

export default {
  schema: './src/database/schema.ts',
  out: './src/database',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DB_URL!,
  },
} satisfies Config;
