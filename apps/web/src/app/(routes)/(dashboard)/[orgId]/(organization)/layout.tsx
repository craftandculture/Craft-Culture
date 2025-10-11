import OrganizationSubheader from '@/app/_organizations/components/OrganizationSubheader';
import NavigationMenuProvider from '@/app/_shared-platform/components/NavigationMenuProvider';

const Layout = ({ children }: React.PropsWithChildren) => {
  return (
    <>
      <NavigationMenuProvider>
        <OrganizationSubheader />
      </NavigationMenuProvider>
      {children}
    </>
  );
};

export default Layout;
