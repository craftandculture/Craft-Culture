
import getAppUrl from './utils/getAppUrl';

const clientConfig = {
  appUrl: getAppUrl(),
} as const;

export default clientConfig;
