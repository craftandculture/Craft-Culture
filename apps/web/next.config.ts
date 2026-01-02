import createMDX from '@next/mdx';
import { withSentryConfig } from '@sentry/nextjs';
import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: true,
    authInterrupts: true,
  },
  allowedDevOrigins: ['jasper.ngrok.app'],
  pageExtensions: ['ts', 'tsx', 'mdx'],
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  redirects: async () => {
    return [
      {
        source: '/',
        destination: '/platform/quotes',
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
      } as const,
      {
        protocol: 'https',
        hostname: 'cwcdst2prdctimgimprtfnct.blob.core.windows.net',
      } as const,
      {
        protocol: 'https',
        hostname: 'craft-and-culture.gitbook.io',
      } as const,
      {
        protocol: 'https',
        hostname: 'media.licdn.com',
      } as const,
      {
        protocol: 'https',
        hostname: 'encrypted-tbn0.gstatic.com',
      } as const,
      ...(process.env.NODE_ENV === 'development'
        ? [
            {
              protocol: 'http',
              hostname: 'localhost',
            } as const,
            {
              protocol: 'http',
              hostname: '127.0.0.1',
            } as const,
          ]
        : []),
    ].filter(Boolean),
  },
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

const configWithMDX = withMDX(nextConfig);

export default process.env.NODE_ENV === 'development'
  ? configWithMDX
  : withSentryConfig(configWithMDX, {
      // For all available options, see:
      // https://www.npmjs.com/package/@sentry/webpack-plugin#options

      org: 'byont-ventures',
      project: 'craft-and-culture',

      // Only print logs for uploading source maps in CI
      silent: !process.env.CI,

      // For all available options, see:
      // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

      // Upload a larger set of source maps for prettier stack traces (increases build time)
      widenClientFileUpload: true,

      // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
      // This can increase your server load as well as your hosting bill.
      // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
      // side errors will fail.
      tunnelRoute: '/monitoring',

      // Automatically tree-shake Sentry logger statements to reduce bundle size
      disableLogger: true,

      // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
      // See the following for more information:
      // https://docs.sentry.io/product/crons/
      // https://vercel.com/docs/cron-jobs
      automaticVercelMonitors: true,
    });
