import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';

const Layout = async ({ children }: React.PropsWithChildren) => {
  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(api.users.getMe.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
};

export default Layout;
