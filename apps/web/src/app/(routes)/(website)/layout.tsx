import { ThemeProvider } from 'next-themes';

import NavigationMenuProvider from '@/app/_shared-platform/components/NavigationMenuProvider';

const Layout = ({ children }: React.PropsWithChildren) => {
  return (
    <>
      <ThemeProvider storageKey="easybooker.theme" forcedTheme="light">
        <NavigationMenuProvider>{children}</NavigationMenuProvider>
      </ThemeProvider>
    </>
  );
};

export default Layout;
