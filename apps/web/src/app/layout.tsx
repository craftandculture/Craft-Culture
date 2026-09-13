import '../globals.css';

import { Metadata } from 'next';
import { twMerge } from 'tailwind-merge';

import clientConfig from '@/client.config';
import { inter, jetbrainsMono } from '@/lib/fonts/fonts';
import serverConfig from '@/server.config';

import SharedProviders from './_shared/components/SharedProviders';

export const preferredRegion = ['fra1'];

export const revalidate = 43_200; // 12 hours

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

/*
  A browser tab shows about thirty characters. The marketing strapline used the
  whole title on a sentence about market entry, so every tab in the platform
  read the same and none of them said which screen it was. The template lets a
  page name itself and keeps the company name as the suffix, where it is still
  legible when the tab is narrow.
*/
export const metadata: Metadata = {
  title: {
    default:
      serverConfig.env === 'development'
        ? 'Craft & Culture Index (dev)'
        : 'Craft & Culture Index',
    template: '%s · Craft & Culture',
  },
  description:
    'The platform behind Craft & Culture: bonded inventory, logistics and private cellars for fine wine in the Middle East.',

  openGraph: {
    siteName: 'Craft & Culture',
    title: 'Craft & Culture Index',
    description:
      'The platform behind Craft & Culture: bonded inventory, logistics and private cellars for fine wine in the Middle East.',
    url: clientConfig.appUrl.toString(),
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    'max-snippet': -1,
    'max-image-preview': 'large',
    'max-video-preview': -1,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-screen">
      <body
        className={twMerge(
          inter.variable,
          jetbrainsMono.variable,
          'bg-background-primary font-sans antialiased',
        )}
      >
        <SharedProviders>{children}</SharedProviders>
      </body>
    </html>
  );
}
