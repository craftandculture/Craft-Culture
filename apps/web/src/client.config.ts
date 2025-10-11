import getAppUrl from './utils/getAppUrl';

const clientConfig = {
  appUrl: getAppUrl(),
  cookiePrefix: 'craft-culture',
} as const;

export default clientConfig;
