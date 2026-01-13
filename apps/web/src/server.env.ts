import { z } from 'zod';

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
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  ADMIN_PHONE_NUMBER: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

const rawEnv = {
  NODE_ENV: process.env.NODE_ENV,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  DB_URL: process.env.DB_URL,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  LOOPS_API_KEY: process.env.LOOPS_API_KEY,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  ADMIN_PHONE_NUMBER: process.env.ADMIN_PHONE_NUMBER,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};

/**
 * Check if all required env vars are present
 * Skip validation during build when env vars aren't available
 */
const hasRequiredEnvVars = () => {
  return !!(
    rawEnv.BETTER_AUTH_SECRET &&
    rawEnv.DB_URL &&
    rawEnv.ENCRYPTION_KEY &&
    rawEnv.LOOPS_API_KEY
  );
};

/**
 * Server environment variables
 * Validation is skipped during build phase when env vars aren't present
 */
const serverEnv = hasRequiredEnvVars()
  ? envSchema.parse(rawEnv)
  : (rawEnv as z.infer<typeof envSchema>);

export default serverEnv;
