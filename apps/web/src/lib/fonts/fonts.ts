import { Inter, JetBrains_Mono  } from 'next/font/google';

export const jetbrainsMono = JetBrains_Mono({
  weight: ['400'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const inter = Inter({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});
