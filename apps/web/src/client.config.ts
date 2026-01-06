import getAppUrl from './utils/getAppUrl';

const isVercelProduction = process.env.VERCEL_ENV === 'production';

const clientConfig = {
  appUrl: isVercelProduction
    ? new URL('https://wine.craftculture.xyz')
    : getAppUrl(),
  cookiePrefix: 'craft-culture',
} as const;

export default clientConfig;
