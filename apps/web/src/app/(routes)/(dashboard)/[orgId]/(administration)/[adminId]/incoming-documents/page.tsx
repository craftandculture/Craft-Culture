import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { SearchParams, createLoader, parseAsJson } from 'nuqs/server';

import DocumentsTable from '@/app/_documents/components/DocumentsTable';
import globalFilterSchema from '@/app/_documents/schemas/filterSchema';
import sortingSchema from '@/app/_documents/schemas/sortingSchema';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';

const Page = async ({
  params,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ orgId: string; adminId: string }>;
  searchParams: Promise<SearchParams>;
}) => {
  const [{ orgId: organizationId, adminId }, searchParams] = await Promise.all([
    params,
    searchParamsPromise,
  ]);

  const { filters, sorting } = createLoader({
    filters: parseAsJson(globalFilterSchema.parse).withDefault({
      operation: 'and',
      filters: [],
    }),
    sorting: parseAsJson(sortingSchema.parse).withDefault([]),
  })(searchParams);

  const queryClient = getQueryClient();

  void queryClient.prefetchInfiniteQuery(
    api.documents.getMany.infiniteQueryOptions({
      administrationId: adminId,
      filters,
      sorting,
    }),
  );

  void queryClient.prefetchQuery(
    api.customFilters.getMany.queryOptions({ organizationId }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DocumentsTable />
    </HydrationBoundary>
  );
};

export default Page;
