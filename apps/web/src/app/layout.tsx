import '../globals.css';

import { Metadata } from 'next';
import { twMerge } from 'tailwind-merge';

import clientConfig from '@/client.config';
import { inter, jetbrainsMono } from '@/lib/fonts/fonts';
import serverConfig from '@/server.config';

import SharedProviders from './_shared/components/SharedProviders';

export const preferredRegion = ['fra1'];

export const revalidate = 43_200; // 12 hours

export const metadata: Metadata = {
  title:
    serverConfig.env === 'development'
      ? 'Craft & Culture - Empowering alcohol / liquor brands to succeed in the GCC markets with comprehensive services'
      : 'Craft & Culture - Empowering alcohol / liquor brands to succeed in the GCC markets with comprehensive services',
  description:
    'We help wine & spirits brands unlock growth opportunities in the Middle East. Providing infrastructure, expertise, and network for seamless market entry and commercial success.',

  openGraph: {
    siteName: 'Craft & Culture',
    title:
      'Craft & Culture - Empowering alcohol / liquor brands to succeed in the GCC markets with comprehensive services',
    description:
      'We help wine & spirits brands unlock growth opportunities in the Middle East. Providing infrastructure, expertise, and network for seamless market entry and commercial success.',
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
