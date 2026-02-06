import serverEnv from './server.env';
import getAppUrl from './utils/getAppUrl';

const serverConfig = {
  env: serverEnv.NODE_ENV,
  appUrl: getAppUrl(),
  betterAuthSecret: serverEnv.BETTER_AUTH_SECRET,
  dbUrl: serverEnv.DB_URL,
  encryptionKey: serverEnv.ENCRYPTION_KEY,
  encryptionKeyBuffer: Buffer.from(serverEnv.ENCRYPTION_KEY || '', 'base64'),
  loopsApiKey: serverEnv.LOOPS_API_KEY,
  twilioAccountSid: serverEnv.TWILIO_ACCOUNT_SID,
  twilioAuthToken: serverEnv.TWILIO_AUTH_TOKEN,
  twilioPhoneNumber: serverEnv.TWILIO_PHONE_NUMBER,
  adminPhoneNumber: serverEnv.ADMIN_PHONE_NUMBER,
  adminDomains: ['byont.nl', 'craftculture.xyz'],
  zohoClientId: serverEnv.ZOHO_CLIENT_ID,
  zohoClientSecret: serverEnv.ZOHO_CLIENT_SECRET,
  zohoRefreshToken: serverEnv.ZOHO_REFRESH_TOKEN,
  zohoOrganizationId: serverEnv.ZOHO_ORGANIZATION_ID,
  zohoRegion: serverEnv.ZOHO_REGION,
  // TODO: Move to env var WMS_DEVICE_TOKEN after fixing Vercel config
  wmsDeviceToken: 'wms_device_2026_CraftCulture_TC27',
  wmsDeviceUserEmail: serverEnv.WMS_DEVICE_USER_EMAIL,
} as const;

export default serverConfig;
