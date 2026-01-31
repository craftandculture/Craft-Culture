'use client';

import {
  IconChevronDown,
  IconChevronRight,
  IconDownload,
  IconLoader2,
  IconPackage,
  IconRefresh,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import LocationBadge from '@/app/_wms/components/LocationBadge';
import useTRPC from '@/lib/trpc/browser';

/**
 * Partner stock view - shows stock owned by the logged-in partner
 */
const PartnerStockPage = () => {
  const api = useTRPC();
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = useQuery({
    ...api.wms.partner.getStock.queryOptions(),
  });

  const toggleProduct = (lwin18: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(lwin18)) {
      newExpanded.delete(lwin18);
    } else {
      newExpanded.add(lwin18);
    }
    setExpandedProducts(newExpanded);
  };

  const handleExportCSV = () => {
    if (!data?.products) return;

    const headers = ['Product', 'LWIN-18', 'Vintage', 'Pack', 'Total Cases', 'Available', 'Reserved'];
    const rows = data.products.map((p) => [
      p.productName,
      p.lwin18,
      p.vintage ?? '',
      `${p.caseConfig}x${p.bottleSize}`,
      p.totalCases,
      p.availableCases,
      p.reservedCases,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Icon icon={IconLoader2} className="animate-spin" size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Typography variant="headingLg">My Stock</Typography>
            <Typography variant="bodyMd" colorRole="muted">
              View your wine inventory stored with Craft & Culture
            </Typography>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <ButtonContent iconLeft={IconRefresh}>Refresh</ButtonContent>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!data?.products?.length}>
              <ButtonContent iconLeft={IconDownload}>Export</ButtonContent>
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {data?.summary && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Typography variant="headingLg">{data.summary.productCount}</Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Products
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Typography variant="headingLg">{data.summary.totalCases}</Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Total Cases
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Typography variant="headingLg" className="text-emerald-600">
                  {data.summary.availableCases}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Available
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Typography variant="headingLg" className="text-amber-600">
                  {data.summary.reservedCases}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Reserved
                </Typography>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Products List */}
        {!data?.products?.length ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Icon icon={IconPackage} size="xl" className="mx-auto mb-4 text-text-muted" />
              <Typography variant="headingSm">No stock yet</Typography>
              <Typography variant="bodyMd" colorRole="muted" className="mt-2">
                Your stock will appear here once shipments are received
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.products.map((product) => {
              const isExpanded = expandedProducts.has(product.lwin18);
              return (
                <Card key={product.lwin18}>
                  <CardContent className="p-0">
                    {/* Product Header */}
                    <button
                      onClick={() => toggleProduct(product.lwin18)}
                      className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-fill-secondary/50"
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          icon={isExpanded ? IconChevronDown : IconChevronRight}
                          size="sm"
                          colorRole="muted"
                        />
                        <div>
                          <Typography variant="bodySm" className="font-semibold">
                            {product.productName}
                          </Typography>
                          <div className="flex items-center gap-2">
                            <Typography variant="bodyXs" colorRole="muted" className="font-mono">
                              {product.lwin18}
                            </Typography>
                            {product.vintage && (
                              <Typography variant="bodyXs" colorRole="muted">
                                {product.vintage}
                              </Typography>
                            )}
                            <Typography variant="bodyXs" colorRole="muted">
                              {product.caseConfig}x{product.bottleSize}
                            </Typography>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-right">
                        <div>
                          <Typography variant="bodySm" className="font-semibold">
                            {product.totalCases}
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            cases
                          </Typography>
                        </div>
                        <div>
                          <Typography variant="bodySm" className="font-semibold text-emerald-600">
                            {product.availableCases}
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            available
                          </Typography>
                        </div>
                        {product.reservedCases > 0 && (
                          <div>
                            <Typography variant="bodySm" className="font-semibold text-amber-600">
                              {product.reservedCases}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              reserved
                            </Typography>
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Expanded Location Details */}
                    {isExpanded && product.locations && product.locations.length > 0 && (
                      <div className="border-t border-border-primary bg-fill-secondary/30 px-4 py-3">
                        <Typography variant="bodyXs" className="mb-2 font-medium text-text-muted">
                          Location Details
                        </Typography>
                        <div className="space-y-2">
                          {product.locations.map((loc, idx) => (
                            <div
                              key={`${loc.locationId}-${idx}`}
                              className="flex items-center justify-between rounded bg-fill-primary p-2"
                            >
                              <div className="flex items-center gap-3">
                                <LocationBadge locationCode={loc.locationCode} size="sm" />
                                {loc.lotNumber && (
                                  <Typography variant="bodyXs" colorRole="muted">
                                    Lot: {loc.lotNumber}
                                  </Typography>
                                )}
                                {loc.expiryDate && (
                                  <Typography variant="bodyXs" className="text-amber-600">
                                    Exp: {new Date(loc.expiryDate).toLocaleDateString()}
                                  </Typography>
                                )}
                              </div>
                              <div className="flex items-center gap-4">
                                <Typography variant="bodyXs">
                                  {loc.quantityCases} cases
                                </Typography>
                                {loc.reservedCases > 0 && (
                                  <Typography variant="bodyXs" className="text-amber-600">
                                    ({loc.reservedCases} reserved)
                                  </Typography>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Last Updated */}
        {data?.products?.length ? (
          <Typography variant="bodyXs" colorRole="muted" className="text-center">
            Last updated {formatDistanceToNow(new Date(), { addSuffix: true })}
          </Typography>
        ) : null}
      </div>
    </div>
  );
};

export default PartnerStockPage;
