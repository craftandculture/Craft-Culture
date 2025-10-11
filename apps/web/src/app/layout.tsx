import '../globals.css';

import { Metadata } from 'next';
import Script from 'next/script';
import { twMerge } from 'tailwind-merge';

import { circular, easybooker, jetbrainsMono } from '@/lib/fonts/fonts';
import serverConfig from '@/server.config';

import SharedProviders from './_shared/components/SharedProviders';

export const preferredRegion = ['fra1'];

export const revalidate = 43_200; // 12 hours

export const metadata: Metadata = {
  title:
    serverConfig.env === 'development'
      ? 'Easybooker - Administraties volledig geautomatiseerd voor boekhouders en ondernemers.'
      : 'Easybooker - Administraties volledig geautomatiseerd voor boekhouders en ondernemers.',
  description:
    'Easybooker is de slimme automatiseringslaag bovenop je boekhoudpakket. Zonder regels, zonder templates. Binnen 90 seconden live.',

  openGraph: {
    siteName: 'Easybooker',
    title:
      'Easybooker - Administraties volledig geautomatiseerd voor boekhouders en ondernemers.',
    description:
      'Easybooker is de slimme automatiseringslaag bovenop je boekhoudpakket. Zonder regels, zonder templates. Bespaart tijd en binnen 90 seconden live.',
    url: 'https://easybooker.nl',
    type: 'website',
  },
  verification: {
    other: {
      'facebook-domain-verification': 'sago0q4tkv99c47tqvyo18lzo2vbd8',
    },
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
    <html lang="nl" suppressHydrationWarning className="h-screen">
      <body
        className={twMerge(
          circular.variable,
          easybooker.variable,
          jetbrainsMono.variable,
          'bg-background-primary font-sans antialiased',
        )}
      >
        <SharedProviders>{children}</SharedProviders>
        <Script
          id="chatwoot-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(d,t) {
                var BASE_URL="https://app.chatwoot.com";
                var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
                g.src=BASE_URL+"/packs/js/sdk.js";
                g.async = true;
                s.parentNode.insertBefore(g,s);
                g.onload=function(){
                  window.chatwootSDK.run({
                    websiteToken: 'd4HmK92MTP6GDgTcsGw3GeKY',
                    baseUrl: BASE_URL
                  })
                }
              })(document,"script");
            `,
          }}
        />
      </body>
    </html>
  );
}
