'use client';

import { ThemeProvider } from 'next-themes';

import clientConfig from '@/client.config';

const Providers = ({ children }: React.PropsWithChildren) => {
  return (
    <ThemeProvider
      enableSystem={true}
      storageKey={`${clientConfig.cookiePrefix}.theme`}
      defaultTheme="light"
    >
      {children}
    </ThemeProvider>
  );
};

export default Providers;
