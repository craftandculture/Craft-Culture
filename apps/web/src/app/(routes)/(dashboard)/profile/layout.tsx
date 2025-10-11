import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import ProfileHeader from '@/app/_auth/components/ProfileHeader';
import DashboardFooter from '@/app/_shared-platform/components/DashboardFooter';
import getQueryClient from '@/lib/react-query';

const Layout = ({ children }: React.PropsWithChildren) => {
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex h-screen min-h-screen flex-col">
        <div className="flex flex-1 flex-col">
          <ProfileHeader />
          {children}
        </div>
        <DashboardFooter />
      </div>
    </HydrationBoundary>
  );
};

export default Layout;
