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
  ZOHO_CLIENT_ID: z.string().optional(),
  ZOHO_CLIENT_SECRET: z.string().optional(),
  ZOHO_REFRESH_TOKEN: z.string().optional(),
  ZOHO_ORGANIZATION_ID: z.string().optional(),
  ZOHO_REGION: z.enum(['us', 'eu', 'in', 'au']).default('us'),
  WMS_DEVICE_TOKEN: z.string().optional(),
  WMS_DEVICE_USER_EMAIL: z.string().email().optional(),
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
  ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID,
  ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET,
  ZOHO_REFRESH_TOKEN: process.env.ZOHO_REFRESH_TOKEN,
  ZOHO_ORGANIZATION_ID: process.env.ZOHO_ORGANIZATION_ID,
  ZOHO_REGION: process.env.ZOHO_REGION,
  WMS_DEVICE_TOKEN: process.env.WMS_DEVICE_TOKEN,
  WMS_DEVICE_USER_EMAIL: process.env.WMS_DEVICE_USER_EMAIL,
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
