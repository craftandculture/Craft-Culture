import { APP_VERSION } from '@/generated/version';

/**
 * Get the current application version
 *
 * @returns The current version string (e.g., "1.3.3")
 */
const getAppVersion = () => {
  return APP_VERSION;
};

export default getAppVersion;
