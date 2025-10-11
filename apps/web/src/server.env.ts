import { z } from 'zod';

const rawEnv = {
  NODE_ENV: process.env.NODE_ENV,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  DB_URL: process.env.DB_URL,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  LOOPS_API_KEY: process.env.LOOPS_API_KEY,
};

const envSchema = z.object({
  NODE_ENV: z
    .union([
      z.literal('development'),
      z.literal('preview'),
      z.literal('production'),
      z.literal('test'),
    ])
    .default('development'),
  BETTER_AUTH_SECRET: z.string(),
  DB_URL: z.string(),
  ENCRYPTION_KEY: z.string(),
  LOOPS_API_KEY: z.string(),
});

const serverEnv = envSchema.parse(rawEnv);

export default serverEnv;
