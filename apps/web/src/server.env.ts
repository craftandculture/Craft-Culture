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
  /** Zoho Billing org, if it differs from Books (usually the same org) */
  ZOHO_BILLING_ORGANIZATION_ID: z.string().optional(),
  ZOHO_BILLING_PLAN_CODE: z.string().default('PRIVATE-CELLAR'),
  ZOHO_BILLING_EXTRA_CASE_ADDON: z.string().default('CELLAR-EXTRA-CASE'),
  /** Shared secret Zoho Billing sends on its webhooks */
  ZOHO_BILLING_WEBHOOK_SECRET: z.string().optional(),
  /** How Private Cellar membership is billed: Zoho Books invoices, or card via Zoho Billing */
  CELLAR_BILLING_MODE: z.enum(['invoice', 'card']).default('invoice'),
  WMS_DEVICE_TOKEN: z.string().optional(),
  WMS_DEVICE_USER_EMAIL: z.string().email().optional(),
  ZEBRA_PRINTER_IP: z.string().optional(),
  // Wine Labs market data: the account's user_id, from winelabs.ai/api/usage
  WINELABS_USER_ID: z.string().optional(),
  WINELABS_BASE_URL: z.string().url().default('https://external-api.wine-labs.com'),
  // Credits a calendar month may spend before calls stop; the plan allows 60k
  WINELABS_MONTHLY_CREDIT_CAP: z.string().optional(),
});

const rawEnvAsSet = {
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
  ZOHO_BILLING_ORGANIZATION_ID: process.env.ZOHO_BILLING_ORGANIZATION_ID,
  ZOHO_BILLING_PLAN_CODE: process.env.ZOHO_BILLING_PLAN_CODE,
  ZOHO_BILLING_EXTRA_CASE_ADDON: process.env.ZOHO_BILLING_EXTRA_CASE_ADDON,
  ZOHO_BILLING_WEBHOOK_SECRET: process.env.ZOHO_BILLING_WEBHOOK_SECRET,
  CELLAR_BILLING_MODE: process.env.CELLAR_BILLING_MODE,
  WMS_DEVICE_TOKEN: process.env.WMS_DEVICE_TOKEN,
  WMS_DEVICE_USER_EMAIL: process.env.WMS_DEVICE_USER_EMAIL,
  ZEBRA_PRINTER_IP: process.env.ZEBRA_PRINTER_IP,
  WINELABS_USER_ID: process.env.WINELABS_USER_ID,
  WINELABS_BASE_URL: process.env.WINELABS_BASE_URL,
  WINELABS_MONTHLY_CREDIT_CAP: process.env.WINELABS_MONTHLY_CREDIT_CAP,
};

/**
 * Every value with any trailing LITERAL escape ("\\n" as two characters)
 * removed
 *
 * Values uploaded to Vercel and Trigger.dev by script arrived with the escape
 * written out instead of interpreted. It is not whitespace, so it survives a
 * trim, and from 3 to 25 Oct 2026 it broke every Zoho sync (the organisation
 * id and every credential ended "\\n"). No real key, id or URL ends that way.
 */
const rawEnv = Object.fromEntries(
  Object.entries(rawEnvAsSet).map(([key, value]) => [
    key,
    typeof value === 'string' ? value.replace(/(\\[nrt])+$/, '') : value,
  ]),
) as typeof rawEnvAsSet;

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
