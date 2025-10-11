import { JetBrains_Mono, Lato } from 'next/font/google';
import localFont from 'next/font/local';

export const jetbrainsMono = JetBrains_Mono({
  weight: ['400'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const lato = Lato({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-lato',
});

export const circular = localFont({
  src: [
    {
      path: './CircularStd/circular-std-medium-500.ttf',
      weight: '500',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-circular',
});

export const easybooker = localFont({
  src: [
    {
      path: './Easybooker/Easybooker_Intl_Bold.woff',
      weight: '700',
      style: 'normal',
    },
    {
      path: './Easybooker/Easybooker_Intl_Medium.woff',
      weight: '500',
      style: 'normal',
    },
    {
      path: './Easybooker/Easybooker_Intl_Regular.woff',
      weight: '400',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-easybooker',
});
