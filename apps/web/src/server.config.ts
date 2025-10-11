import serverEnv from './server.env';
import getAppUrl from './utils/getAppUrl';

const serverConfig = {
  env: serverEnv.NODE_ENV,
  appUrl: getAppUrl(),
  betterAuthSecret: serverEnv.BETTER_AUTH_SECRET,
  dbUrl: serverEnv.DB_URL,
  encryptionKey: serverEnv.ENCRYPTION_KEY,
  encryptionKeyBuffer: Buffer.from(serverEnv.ENCRYPTION_KEY, 'base64'),
  loopsApiKey: serverEnv.LOOPS_API_KEY,
  
} as const;

export default serverConfig;
