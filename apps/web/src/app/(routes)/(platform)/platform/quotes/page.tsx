import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { SearchParams, createLoader } from 'nuqs/server';

import QuotesForm from '@/app/_quotes/components/QuotesForm';
import quotesSearchParams from '@/app/_quotes/search-params/filtersSearchParams';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';

const QuotesPage = async ({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<SearchParams>;
}) => {
  const searchParams = await searchParamsPromise;

  const { items } = createLoader(quotesSearchParams)(searchParams);

  const queryClient = getQueryClient();

  const productIds = [...new Set(items.map((item) => item.productId))];

  if (productIds.length > 0) {
    void queryClient.prefetchQuery(
      api.products.getMany.queryOptions({
        productIds,
      }),
    );
  }

  if (items.length > 0) {
    void queryClient.prefetchQuery(
      api.quotes.get.queryOptions({
        lineItems: items,
      }),
    );
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="container py-4 landscape:py-2 md:py-16">
        <Card className="w-full">
          <CardContent>
            <QuotesForm />
          </CardContent>
        </Card>
      </main>
    </HydrationBoundary>
  );
};

export default QuotesPage;
