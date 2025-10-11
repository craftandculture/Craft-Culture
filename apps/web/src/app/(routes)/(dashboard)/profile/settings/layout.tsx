import ProfileSettingsSideMenu from '@/app/_auth/components/ProfileSettingsSideMenu';
import NavigationMenuProvider from '@/app/_shared-platform/components/NavigationMenuProvider';
import Typography from '@/app/_ui/components/Typography/Typography';

const Layout = ({ children }: React.PropsWithChildren) => {
  return (
    <main className="container space-y-6 py-6 md:space-y-12 md:py-12">
      <Typography variant="headingLg" asChild>
        <h1>Profiel</h1>
      </Typography>
      <div className="flex w-full grow flex-col gap-6 overflow-y-scroll md:flex-row md:items-start">
        <NavigationMenuProvider>
          <ProfileSettingsSideMenu />
        </NavigationMenuProvider>
        <div className="flex grow flex-col gap-6 md:w-full">{children}</div>
      </div>
    </main>
  );
};

export default Layout;
