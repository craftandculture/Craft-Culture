'use client';

import { ThemeProvider } from 'next-themes';

const Providers = ({ children }: React.PropsWithChildren) => {
  return (
    <ThemeProvider
      enableSystem={true}
      storageKey="craft-culture.theme"
      defaultTheme="light"
    >
      {children}
    </ThemeProvider>
  );
};

export default Providers;
