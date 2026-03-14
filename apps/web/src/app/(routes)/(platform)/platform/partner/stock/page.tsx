'use client';

import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconChevronRight,
  IconDownload,
  IconLoader2,
  IconPackage,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { useMemo, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import LocationBadge from '@/app/_wms/components/LocationBadge';
import useTRPC from '@/lib/trpc/browser';

interface MovementBadgeProps {
  type: string;
  isInbound: boolean;
  qty: number;
}

/** Badge for movement type with directional quantity */
const MovementBadge = ({ type, isInbound, qty }: MovementBadgeProps) => {
  const config: Record<string, { label: string; color: string }> = {
    receive: { label: 'Received', color: 'bg-emerald-100 text-emerald-700' },
    pick: { label: 'Picked', color: 'bg-amber-100 text-amber-700' },
    dispatch: { label: 'Dispatched', color: 'bg-blue-100 text-blue-700' },
    transfer: { label: 'Transferred', color: 'bg-gray-100 text-gray-600' },
    adjust: { label: 'Adjusted', color: 'bg-purple-100 text-purple-700' },
    count: { label: 'Counted', color: 'bg-gray-100 text-gray-600' },
    repack_in: { label: 'Repack In', color: 'bg-emerald-100 text-emerald-700' },
    repack_out: { label: 'Repack Out', color: 'bg-amber-100 text-amber-700' },
  };

  const { label, color } = config[type] ?? { label: type, color: 'bg-gray-100 text-gray-600' };

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
        {label}
      </span>
      <span className={`text-sm font-medium ${isInbound ? 'text-emerald-600' : 'text-amber-600'}`}>
        {isInbound ? '+' : '-'}{qty}
      </span>
    </div>
  );
};

/**
 * Partner stock view - shows stock owned by the logged-in partner
 */
const PartnerStockPage = () => {
  const api = useTRPC();
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch } = useQuery({
    ...api.wms.partner.getStock.queryOptions(),
  });

  const filteredProducts = useMemo(() => {
    if (!data?.products) return [];
    if (!search.trim()) return data.products;
    const q = search.toLowerCase();
    return data.products.filter(
      (p) =>
        p.productName.toLowerCase().includes(q) ||
        p.lwin18.toLowerCase().includes(q) ||
        (p.vintage && p.vintage.toLowerCase().includes(q)),
    );
  }, [data?.products, search]);

  const toggleProduct = (lwin18: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(lwin18)) {
      newExpanded.delete(lwin18);
    } else {
      newExpanded.add(lwin18);
    }
    setExpandedProducts(newExpanded);
  };

  /** Get movements for a specific product */
  const getProductMovements = (lwin18: string) => {
    if (!data?.recentMovements) return [];
    return data.recentMovements.filter((m) => m.lwin18 === lwin18);
  };

  /** Check if a movement is inbound to this partner */
  const isInbound = (movement: { toOwnerId: string | null; fromOwnerId: string | null }) => {
    return movement.toOwnerId === data?.partner.id;
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
            <Typography variant="headingLg">Local Stock</Typography>
            <Typography variant="bodyMd" colorRole="muted">
              Products stored at C&C bonded warehouse
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

        {/* Search */}
        <Input
          placeholder="Search by product name, LWIN, or vintage..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          iconLeft={IconSearch}
          className="max-w-md"
        />

        {/* Products List */}
        {!filteredProducts.length ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Icon icon={IconPackage} size="xl" className="mx-auto mb-4 text-text-muted" />
              <Typography variant="headingSm">
                {search ? 'No products match your search' : 'No stock yet'}
              </Typography>
              <Typography variant="bodyMd" colorRole="muted" className="mt-2">
                {search
                  ? 'Try adjusting your search terms'
                  : 'Your stock will appear here once shipments are received'}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((product) => {
              const isExpanded = expandedProducts.has(product.lwin18);
              const productMovements = isExpanded ? getProductMovements(product.lwin18) : [];
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

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-border-primary bg-fill-secondary/30 px-4 py-3">
                        {/* Location Details */}
                        {product.locations && product.locations.length > 0 && (
                          <div className="mb-4">
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

                        {/* Product Movement History */}
                        {productMovements.length > 0 && (
                          <div>
                            <Typography variant="bodyXs" className="mb-2 font-medium text-text-muted">
                              Movement History
                            </Typography>
                            <div className="space-y-1">
                              {productMovements.map((m) => (
                                <div
                                  key={m.id}
                                  className="flex items-center justify-between rounded bg-fill-primary px-3 py-2"
                                >
                                  <div className="flex items-center gap-3">
                                    <Typography variant="bodyXs" colorRole="muted" className="w-20 shrink-0">
                                      {format(new Date(m.performedAt), 'dd MMM yy')}
                                    </Typography>
                                    <MovementBadge
                                      type={m.movementType}
                                      isInbound={isInbound(m)}
                                      qty={m.quantityCases}
                                    />
                                  </div>
                                  <Typography variant="bodyXs" colorRole="muted">
                                    {m.quantityCases} cases
                                  </Typography>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* No movements message */}
                        {productMovements.length === 0 && (!product.locations || product.locations.length === 0) && (
                          <Typography variant="bodyXs" colorRole="muted">
                            No location or movement data available
                          </Typography>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Recent Activity */}
        {data?.recentMovements && data.recentMovements.length > 0 && (
          <div>
            <Typography variant="headingSm" className="mb-3">
              Recent Activity
            </Typography>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border-primary">
                  {data.recentMovements.slice(0, 10).map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isInbound(m) ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                          <Icon
                            icon={isInbound(m) ? IconArrowDown : IconArrowUp}
                            size="sm"
                            className={isInbound(m) ? 'text-emerald-600' : 'text-amber-600'}
                          />
                        </div>
                        <div>
                          <Typography variant="bodySm" className="font-medium">
                            {m.productName}
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            {format(new Date(m.performedAt), 'dd MMM yyyy, HH:mm')}
                            {m.notes && ` — ${m.notes}`}
                          </Typography>
                        </div>
                      </div>
                      <MovementBadge
                        type={m.movementType}
                        isInbound={isInbound(m)}
                        qty={m.quantityCases}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
