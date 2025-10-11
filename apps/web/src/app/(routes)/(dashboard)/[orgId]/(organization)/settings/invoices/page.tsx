import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import InvoiceList from '@/app/_settings/components/InvoiceList';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';

import type { OrganizationRoute } from '../../../layout';

const Page = async ({ params }: OrganizationRoute) => {
  const { orgId } = await params;

  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(
    api.organizations.invoices.getAll.queryOptions({
      organizationId: orgId,
    }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <InvoiceList />
    </HydrationBoundary>
  );
};

export default Page;
