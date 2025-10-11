'use client';

import { ThemeProvider } from 'next-themes';

const Providers = ({ children }: React.PropsWithChildren) => {
  return (
    <ThemeProvider
      enableSystem={true}
      storageKey="easybooker.theme"
      defaultTheme="light"
    >
      {children}
    </ThemeProvider>
  );
};

export default Providers;
