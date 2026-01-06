import getAppUrl from './utils/getAppUrl';

// Use NEXT_PUBLIC_VERCEL_ENV for client-side code (VERCEL_ENV is server-only)
const isVercelProduction = process.env.NEXT_PUBLIC_VERCEL_ENV === 'production';

const clientConfig = {
  appUrl: isVercelProduction
    ? new URL('https://wine.craftculture.xyz')
    : getAppUrl(),
  cookiePrefix: 'craft-culture',
} as const;

export default clientConfig;
