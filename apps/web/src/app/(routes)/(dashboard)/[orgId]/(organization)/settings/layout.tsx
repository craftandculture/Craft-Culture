import OrganizationSettingsSideMenu from '@/app/_organizations/components/OrganizationSettingsSideMenu';
import NavigationMenuProvider from '@/app/_shared-platform/components/NavigationMenuProvider';
import Typography from '@/app/_ui/components/Typography/Typography';

import type { OrganizationRoute } from '../../layout';

const Layout = ({ children }: React.PropsWithChildren<OrganizationRoute>) => {
  return (
    <main className="container space-y-6 py-6 md:space-y-12 md:py-12">
      <Typography variant="headingLg" asChild>
        <h1>Team instellingen</h1>
      </Typography>
      <div className="flex w-full grow flex-col gap-6 overflow-y-scroll md:flex-row md:items-start">
        <NavigationMenuProvider>
          <OrganizationSettingsSideMenu />
        </NavigationMenuProvider>
        <div className="flex grow flex-col gap-6 md:w-full">{children}</div>
      </div>
    </main>
  );
};

export default Layout;
