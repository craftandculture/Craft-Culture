import { Cormorant_Garamond, Inter, JetBrains_Mono } from 'next/font/google';

export const jetbrainsMono = JetBrains_Mono({
  weight: ['400'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const inter = Inter({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

/**
 * The Private Cellar's display serif, for page titles and wine names
 *
 * Exposed as a CSS variable and applied only inside the cellar layout, so the
 * rest of Index keeps Inter throughout.
 */
export const cellarSerif = Cormorant_Garamond({
  weight: ['500', '600'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-cellar-serif',
});
