import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { SearchParams, createLoader } from 'nuqs/server';

import QuotesForm from '@/app/_quotes/components/QuotesForm';
import quotesSearchParams from '@/app/_quotes/search-params/filtersSearchParams';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardProse from '@/app/_ui/components/Card/CardProse';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
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
      <main className="container py-8 md:py-16">
        <Card className="mx-auto w-full max-w-6xl">
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <CardProse>
                <CardTitle>Quotation Tool</CardTitle>
                <CardDescription colorRole="muted">
                  Please select references to generate a quotation.
                </CardDescription>
              </CardProse>
            </div>
            <QuotesForm />
          </CardContent>
        </Card>
      </main>
    </HydrationBoundary>
  );
};

export default QuotesPage;
