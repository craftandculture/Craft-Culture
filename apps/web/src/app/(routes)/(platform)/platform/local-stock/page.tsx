'use client';

import { IconPackage, IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import { useTRPCClient } from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

/**
 * Local Stock page for wine partners
 *
 * Shows products available in C&C local inventory with search and filtering
 */
const LocalStockPage = () => {
  const trpcClient = useTRPCClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['products.getMany', 'local_inventory', search],
    queryFn: () =>
      trpcClient.products.getMany.query({
        source: 'local_inventory',
        search: search || undefined,
        limit: 100,
      }),
  });

  const products = data?.data ?? [];
  const totalCount = data?.meta.totalCount ?? 0;

  return (
    <div className="container py-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Typography variant="headingLg">Local Stock</Typography>
          <Typography variant="bodySm" colorRole="muted" className="mt-1">
            Products available in C&C bonded warehouse for immediate dispatch
          </Typography>
        </div>
        <div className="flex items-center gap-2">
          <Icon icon={IconPackage} colorRole="brand" />
          <Typography variant="labelMd" colorRole="brand">
            {totalCount} {totalCount === 1 ? 'product' : 'products'}
          </Typography>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Search by name, producer, region, or LWIN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          iconLeft={IconSearch}
          className="max-w-md"
        />
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Typography variant="bodySm" colorRole="muted">
                Loading inventory...
              </Typography>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Icon icon={IconPackage} size="xl" colorRole="muted" className="mb-3" />
              <Typography variant="bodySm" colorRole="muted">
                {search ? 'No products match your search' : 'No products in local inventory'}
              </Typography>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-muted bg-surface-secondary/50">
                    <th className="px-4 py-3 text-left">
                      <Typography variant="labelSm">Product</Typography>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <Typography variant="labelSm">Producer</Typography>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <Typography variant="labelSm">Region</Typography>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <Typography variant="labelSm">Vintage</Typography>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <Typography variant="labelSm">Pack Size</Typography>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <Typography variant="labelSm">Available</Typography>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <Typography variant="labelSm">Price (AED)</Typography>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const offer = product.productOffers?.find(
                      (o) => o.source === 'local_inventory',
                    );
                    const priceUsd = offer?.inBondPriceUsd ?? offer?.price ?? 0;
                    const priceAed = priceUsd * 3.67;

                    return (
                      <tr
                        key={product.id}
                        className="border-b border-border-muted last:border-0 hover:bg-surface-secondary/30"
                      >
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <Typography variant="bodySm" className="font-medium">
                              {product.name}
                            </Typography>
                            {product.lwin18 && (
                              <Typography variant="bodyXs" colorRole="muted">
                                LWIN: {product.lwin18}
                              </Typography>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Typography variant="bodySm" colorRole="muted">
                            {product.producer ?? '-'}
                          </Typography>
                        </td>
                        <td className="px-4 py-3">
                          <Typography variant="bodySm" colorRole="muted">
                            {product.region ?? '-'}
                          </Typography>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Typography variant="bodySm">
                            {product.year === 0 ? 'NV' : product.year ?? '-'}
                          </Typography>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Typography variant="bodySm" colorRole="muted">
                            {offer ? `${offer.unitCount}×${offer.unitSize}` : '-'}
                          </Typography>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {offer?.availableQuantity !== null &&
                          offer?.availableQuantity !== undefined ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                offer.availableQuantity > 0
                                  ? 'bg-fill-success/10 text-text-success'
                                  : 'bg-fill-danger/10 text-text-danger'
                              }`}
                            >
                              {offer.availableQuantity}{' '}
                              {offer.availableQuantity === 1 ? 'case' : 'cases'}
                            </span>
                          ) : (
                            <Typography variant="bodySm" colorRole="muted">
                              -
                            </Typography>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Typography variant="bodySm" className="font-medium">
                            {priceAed > 0 ? formatPrice(priceAed, 'AED') : '-'}
                          </Typography>
                          {priceUsd > 0 && (
                            <Typography variant="bodyXs" colorRole="muted">
                              {formatPrice(priceUsd, 'USD')}
                            </Typography>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LocalStockPage;
