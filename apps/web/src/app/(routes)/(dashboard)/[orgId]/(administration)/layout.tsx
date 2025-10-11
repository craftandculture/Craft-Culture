import AdministrationSubheader from '@/app/_administrations/components/AdministrationSubheader';
import NavigationMenuProvider from '@/app/_shared-platform/components/NavigationMenuProvider';

import type { OrganizationRoute } from '../layout';

export type AdministrationRoute<
  T extends Record<string, string> = Record<string, string>,
> = {
  params: Promise<T & { orgId: string; adminId: string }>;
};

const Layout = ({ children }: React.PropsWithChildren<OrganizationRoute>) => {
  return (
    <>
      <NavigationMenuProvider>
        <AdministrationSubheader />
      </NavigationMenuProvider>
      {children}
    </>
  );
};

export default Layout;
