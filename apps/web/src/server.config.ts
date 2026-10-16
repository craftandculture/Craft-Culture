import serverEnv from './server.env';
import getAppUrl from './utils/getAppUrl';

const serverConfig = {
  env: serverEnv.NODE_ENV,
  // Origin, not the URL object: interpolated, the object kept its trailing slash, so links read ".xyz//join"
  appUrl: getAppUrl().origin,
  betterAuthSecret: serverEnv.BETTER_AUTH_SECRET,
  dbUrl: serverEnv.DB_URL,
  encryptionKey: serverEnv.ENCRYPTION_KEY,
  encryptionKeyBuffer: Buffer.from(serverEnv.ENCRYPTION_KEY || '', 'base64'),
  loopsApiKey: serverEnv.LOOPS_API_KEY,
  twilioAccountSid: serverEnv.TWILIO_ACCOUNT_SID,
  twilioAuthToken: serverEnv.TWILIO_AUTH_TOKEN,
  twilioPhoneNumber: serverEnv.TWILIO_PHONE_NUMBER,
  adminPhoneNumber: serverEnv.ADMIN_PHONE_NUMBER,
  adminDomains: ['craftculture.xyz'],
  zohoClientId: serverEnv.ZOHO_CLIENT_ID,
  zohoClientSecret: serverEnv.ZOHO_CLIENT_SECRET,
  zohoRefreshToken: serverEnv.ZOHO_REFRESH_TOKEN,
  zohoOrganizationId: serverEnv.ZOHO_ORGANIZATION_ID,
  zohoRegion: serverEnv.ZOHO_REGION,
  zohoBillingOrganizationId: serverEnv.ZOHO_BILLING_ORGANIZATION_ID,
  zohoBillingPlanCode: serverEnv.ZOHO_BILLING_PLAN_CODE,
  zohoBillingExtraCaseAddon: serverEnv.ZOHO_BILLING_EXTRA_CASE_ADDON,
  zohoBillingWebhookSecret: serverEnv.ZOHO_BILLING_WEBHOOK_SECRET,
  cellarBillingMode: serverEnv.CELLAR_BILLING_MODE,
  wmsDeviceToken: serverEnv.WMS_DEVICE_TOKEN,
  wmsDeviceUserEmail: serverEnv.WMS_DEVICE_USER_EMAIL,
  zebraPrinterIp: serverEnv.ZEBRA_PRINTER_IP || '192.168.0.112',
  zebraPrinterPort: 9100,
} as const;

export default serverConfig;
