'use client';

import {
  IconArrowLeft,
  IconBox,
  IconDownload,
  IconLoader2,
  IconMapPin,
  IconPackageImport,
  IconSearch,
  IconUser,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import CapacityBar from '@/app/_wms/components/CapacityBar';
import ExpiryBadge from '@/app/_wms/components/ExpiryBadge';
import LocationBadge from '@/app/_wms/components/LocationBadge';
import OwnerBadge from '@/app/_wms/components/OwnerBadge';
import useTRPC from '@/lib/trpc/browser';

type TabView = 'product' | 'location' | 'owner';

/**
 * WMS Stock Overview - comprehensive view of all warehouse stock
 * with tabs for by-product, by-location, and by-owner views
 */
const WMSStockPage = () => {
  const api = useTRPC();
  const [activeTab, setActiveTab] = useState<TabView>('product');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch stock by product
  const { data: productData, isLoading: productsLoading } = useQuery({
    ...api.wms.admin.stock.getByProduct.queryOptions({
      search: searchQuery || undefined,
      limit: 50,
    }),
    enabled: activeTab === 'product',
  });

  // Fetch locations with stock
  const { data: locationData, isLoading: locationsLoading } = useQuery({
    ...api.wms.admin.locations.getMany.queryOptions({
      isActive: true,
    }),
    enabled: activeTab === 'location',
  });

  // Fetch stock by owner
  const { data: ownerData, isLoading: ownersLoading } = useQuery({
    ...api.wms.admin.stock.getByOwner.queryOptions({}),
    enabled: activeTab === 'owner',
  });

  const isLoading =
    (activeTab === 'product' && productsLoading) ||
    (activeTab === 'location' && locationsLoading) ||
    (activeTab === 'owner' && ownersLoading);

  const tabs: { id: TabView; label: string; icon: typeof IconBox }[] = [
    { id: 'product', label: 'By Product', icon: IconBox },
    { id: 'location', label: 'By Location', icon: IconMapPin },
    { id: 'owner', label: 'By Owner', icon: IconUser },
  ];

  return (
    <div className="container mx-auto max-w-lg px-4 py-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link
            href="/platform/admin/wms"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fill-secondary text-text-muted transition-colors hover:bg-fill-primary hover:text-text-primary active:bg-fill-secondary"
          >
            <IconArrowLeft className="h-6 w-6" />
          </Link>
          <div className="min-w-0 flex-1">
            <Typography variant="headingLg" className="mb-1">
              Stock
            </Typography>
            <div className="flex gap-2">
              <Link href="/platform/admin/wms/stock/import">
                <Button variant="primary" size="sm">
                  <ButtonContent iconLeft={IconPackageImport}>Import</ButtonContent>
                </Button>
              </Link>
              <Button variant="outline" size="sm">
                <ButtonContent iconLeft={IconDownload}>Export</ButtonContent>
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-fill-secondary p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-fill-primary text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon icon={tab.icon} size="sm" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Search (for product view) */}
        {activeTab === 'product' && (
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search products, LWIN, or producer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border-primary bg-fill-primary py-2 pl-10 pr-4 text-sm focus:border-border-brand focus:outline-none focus:ring-1 focus:ring-border-brand"
            />
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
          </div>
        )}

        {/* Product View */}
        {activeTab === 'product' && !productsLoading && productData && (
          <div className="space-y-3">
            {productData.products.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Icon icon={IconBox} size="xl" colorRole="muted" className="mx-auto mb-4" />
                  <Typography variant="headingSm" className="mb-2">
                    No Stock Found
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    {searchQuery
                      ? `No products matching "${searchQuery}"`
                      : 'No stock in warehouse yet'}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              productData.products.map((product) => (
                <Card key={product.lwin18} className="hover:border-border-brand">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <Typography variant="headingSm">{product.productName}</Typography>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-muted">
                          {product.producer && <span>{product.producer}</span>}
                          {product.vintage && <span>• {product.vintage}</span>}
                          <span>• {product.caseConfig}x{product.bottleSize}</span>
                        </div>
                        <Typography variant="bodyXs" colorRole="muted" className="mt-1 font-mono">
                          {product.lwin18}
                        </Typography>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Typography variant="headingMd" className="text-blue-600">
                            {product.totalCases}
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            cases ({product.totalBottles} btl)
                          </Typography>
                        </div>
                        {product.hasPerishable && (
                          <ExpiryBadge
                            expiryDate={product.earliestExpiry}
                            isPerishable={product.hasPerishable}
                            size="sm"
                          />
                        )}
                      </div>
                    </div>

                    {/* Location breakdown */}
                    {product.locations.length > 0 && (
                      <div className="mt-4 border-t border-border-primary pt-4">
                        <Typography variant="bodyXs" colorRole="muted" className="mb-2">
                          {product.locationCount} location{product.locationCount !== 1 ? 's' : ''} •{' '}
                          {product.ownerCount} owner{product.ownerCount !== 1 ? 's' : ''}
                        </Typography>
                        <div className="flex flex-wrap gap-2">
                          {product.locations.slice(0, 5).map((loc, idx) => (
                            <div
                              key={`${loc.locationId}-${idx}`}
                              className="flex items-center gap-2 rounded bg-fill-secondary px-2 py-1"
                            >
                              <LocationBadge locationCode={loc.locationCode} size="sm" />
                              <Typography variant="bodyXs">
                                {loc.quantityCases} cs
                              </Typography>
                              <OwnerBadge ownerName={loc.ownerName} size="sm" />
                            </div>
                          ))}
                          {product.locations.length > 5 && (
                            <Typography variant="bodyXs" colorRole="muted" className="self-center">
                              +{product.locations.length - 5} more
                            </Typography>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}

            {/* Pagination info */}
            {productData.pagination.total > 0 && (
              <Typography variant="bodyXs" colorRole="muted" className="text-center">
                Showing {productData.products.length} of {productData.pagination.total} products
              </Typography>
            )}
          </div>
        )}

        {/* Location View */}
        {activeTab === 'location' && !locationsLoading && locationData && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {locationData.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="p-8 text-center">
                  <Icon icon={IconMapPin} size="xl" colorRole="muted" className="mx-auto mb-4" />
                  <Typography variant="headingSm" className="mb-2">
                    No Locations
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    Create warehouse locations first
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              locationData.map((location) => (
                <Link
                  key={location.id}
                  href={`/platform/admin/wms/locations/${location.id}`}
                >
                  <Card className="h-full cursor-pointer transition-colors hover:border-border-brand">
                    <CardContent className="p-4">
                      <div className="mb-3 flex items-start justify-between">
                        <LocationBadge
                          locationCode={location.locationCode}
                          locationType={location.locationType as 'rack' | 'floor' | 'receiving' | 'shipping'}
                          requiresForklift={location.requiresForklift ?? false}
                          size="md"
                        />
                        {location.totalCases > 0 && (
                          <Typography variant="headingSm" className="text-blue-600">
                            {location.totalCases}
                          </Typography>
                        )}
                      </div>
                      <CapacityBar
                        currentCases={location.totalCases ?? 0}
                        maxCapacity={location.capacityCases}
                        showPercent
                      />
                      <Typography variant="bodyXs" colorRole="muted" className="mt-2">
                        {location.productCount ?? 0} product{(location.productCount ?? 0) !== 1 ? 's' : ''}
                      </Typography>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Owner View */}
        {activeTab === 'owner' && !ownersLoading && ownerData && 'owners' in ownerData && (
          <div className="space-y-3">
            {/* Grand totals */}
            <Card className="bg-fill-secondary">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Total Cases
                    </Typography>
                    <Typography variant="headingMd">
                      {ownerData.grandTotals.totalCases.toLocaleString()}
                    </Typography>
                  </div>
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Available
                    </Typography>
                    <Typography variant="headingMd" className="text-emerald-600">
                      {ownerData.grandTotals.availableCases.toLocaleString()}
                    </Typography>
                  </div>
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Reserved
                    </Typography>
                    <Typography variant="headingMd" className="text-amber-600">
                      {ownerData.grandTotals.reservedCases.toLocaleString()}
                    </Typography>
                  </div>
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Owners
                    </Typography>
                    <Typography variant="headingMd">
                      {ownerData.grandTotals.ownerCount}
                    </Typography>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Owner list */}
            {ownerData.owners.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Icon icon={IconUser} size="xl" colorRole="muted" className="mx-auto mb-4" />
                  <Typography variant="headingSm" className="mb-2">
                    No Stock Owners
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    Stock will appear here once received
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              ownerData.owners.map((owner) => (
                <Card key={owner.ownerId} className="hover:border-border-brand">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <OwnerBadge
                          ownerName={owner.ownerName}
                          isOwnStock={owner.ownerName.toLowerCase().includes('c&c')}
                        />
                        <div className="mt-2 flex flex-wrap gap-3 text-sm text-text-muted">
                          <span>{owner.productCount} products</span>
                          <span>• {owner.locationCount} locations</span>
                          {owner.consignmentCount > 0 && (
                            <span className="text-purple-600">
                              • {owner.consignmentCount} consignment
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <Typography variant="headingMd" className="text-blue-600">
                            {owner.totalCases.toLocaleString()}
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            total cases
                          </Typography>
                        </div>
                        <div className="text-center">
                          <Typography variant="headingMd" className="text-emerald-600">
                            {owner.availableCases.toLocaleString()}
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            available
                          </Typography>
                        </div>
                        {owner.reservedCases > 0 && (
                          <div className="text-center">
                            <Typography variant="headingMd" className="text-amber-600">
                              {owner.reservedCases.toLocaleString()}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              reserved
                            </Typography>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WMSStockPage;
