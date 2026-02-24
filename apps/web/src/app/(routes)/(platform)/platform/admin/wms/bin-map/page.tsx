'use client';

import {
  IconArrowLeft,
  IconBox,
  IconBuildingWarehouse,
  IconChevronDown,
  IconChevronUp,
  IconForklift,
  IconLoader2,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import Badge from '@/app/_ui/components/Badge/Badge';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

interface LocationData {
  id: string;
  locationCode: string;
  aisle: string;
  bay: string;
  level: string;
  locationType: string;
  storageMethod: string | null;
  requiresForklift: boolean;
  isActive: boolean;
  totalCases: number;
  productCount: number;
}

interface BayGroup {
  aisle: string;
  bay: string;
  levels: LocationData[];
  totalCases: number;
  totalProducts: number;
}

/**
 * WMS Bin Map - visual warehouse floor plan and elevation view
 *
 * Shows a bird's-eye grid of all bays color-coded by stock level.
 * Tap a bay to see the elevation (all 4 levels) with stock detail.
 */
const BinMapPage = () => {
  const api = useTRPC();
  const [selectedBay, setSelectedBay] = useState<string | null>(null);
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);

  const { data: locations, isLoading } = useQuery({
    ...api.wms.admin.locations.getMany.queryOptions({}),
  });

  // Fetch stock detail for the expanded level
  const { data: levelDetail, isLoading: isLoadingDetail } = useQuery({
    ...api.wms.admin.locations.getOne.queryOptions({ id: expandedLevel ?? '' }),
    enabled: !!expandedLevel,
  });

  // Group locations into aisles → bays
  const { aisleGroups, stats } = useMemo(() => {
    if (!locations) return { aisleGroups: new Map<string, BayGroup[]>(), stats: { occupied: 0, empty: 0, totalCases: 0 } };

    const bayMap = new Map<string, BayGroup>();
    let occupied = 0;
    let empty = 0;
    let totalCases = 0;

    for (const loc of locations) {
      if (loc.locationType !== 'rack') continue;

      if (loc.totalCases > 0) {
        occupied++;
        totalCases += loc.totalCases;
      } else {
        empty++;
      }

      const key = `${loc.aisle}-${loc.bay}`;
      const existing = bayMap.get(key);
      if (existing) {
        existing.levels.push(loc);
        existing.totalCases += loc.totalCases;
        existing.totalProducts += loc.productCount;
      } else {
        bayMap.set(key, {
          aisle: loc.aisle,
          bay: loc.bay,
          levels: [loc],
          totalCases: loc.totalCases,
          totalProducts: loc.productCount,
        });
      }
    }

    // Sort levels within each bay (descending: top level first)
    for (const group of bayMap.values()) {
      group.levels.sort((a, b) => b.level.localeCompare(a.level));
    }

    // Group bays by aisle
    const grouped = new Map<string, BayGroup[]>();
    for (const bay of bayMap.values()) {
      const existing = grouped.get(bay.aisle);
      if (existing) {
        existing.push(bay);
      } else {
        grouped.set(bay.aisle, [bay]);
      }
    }

    // Sort bays within each aisle
    for (const bays of grouped.values()) {
      bays.sort((a, b) => a.bay.localeCompare(b.bay));
    }

    return { aisleGroups: grouped, stats: { occupied, empty, totalCases } };
  }, [locations]);

  const sortedAisles = [...aisleGroups.keys()].sort();

  // Get the selected bay group
  const selectedBayGroup = useMemo(() => {
    if (!selectedBay) return null;
    const [aisle, bay] = selectedBay.split('-');
    const bays = aisleGroups.get(aisle ?? '');
    return bays?.find((b) => b.bay === bay) ?? null;
  }, [selectedBay, aisleGroups]);

  const handleBayTap = (aisle: string, bay: string) => {
    const key = `${aisle}-${bay}`;
    if (selectedBay === key) {
      setSelectedBay(null);
      setExpandedLevel(null);
    } else {
      setSelectedBay(key);
      setExpandedLevel(null);
    }
  };

  const handleLevelTap = (locationId: string) => {
    setExpandedLevel(expandedLevel === locationId ? null : locationId);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-lg md:max-w-3xl lg:max-w-5xl px-4 py-6">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-lg md:max-w-3xl lg:max-w-5xl px-4 py-6">
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
              Bin Map
            </Typography>
            <div className="flex flex-wrap gap-2">
              <Badge colorRole="success" size="sm">
                {stats.occupied} occupied
              </Badge>
              <Badge colorRole="muted" size="sm">
                {stats.empty} empty
              </Badge>
              <Badge colorRole="info" size="sm">
                {stats.totalCases} cases
              </Badge>
            </div>
          </div>
        </div>

        {/* Floor Plan */}
        <Card>
          <CardContent className="p-4">
            <Typography variant="bodySm" className="mb-3 font-medium">
              Floor Plan
            </Typography>

            {/* Special zones */}
            <div className="mb-4 flex gap-2">
              <div className="flex-1 rounded-lg border border-dashed border-emerald-300 bg-emerald-50 p-2 text-center dark:border-emerald-700 dark:bg-emerald-900/20">
                <Typography variant="bodyXs" className="font-semibold text-emerald-700 dark:text-emerald-400">
                  GOODS INBOUND
                </Typography>
              </div>
              <div className="flex-1 rounded-lg border border-dashed border-orange-300 bg-orange-50 p-2 text-center dark:border-orange-700 dark:bg-orange-900/20">
                <Typography variant="bodyXs" className="font-semibold text-orange-700 dark:text-orange-400">
                  SHIPPING
                </Typography>
              </div>
            </div>

            {/* Aisle rows */}
            <div className="space-y-3">
              {sortedAisles.map((aisle, idx) => {
                const bays = aisleGroups.get(aisle) ?? [];
                const aisleCases = bays.reduce((s, b) => s + b.totalCases, 0);

                return (
                  <div key={aisle}>
                    {/* Aisle walkway separator */}
                    {idx > 0 && (
                      <div className="my-2 flex items-center gap-2">
                        <div className="h-px flex-1 border-t border-dashed border-border-primary" />
                        <Typography variant="bodyXs" colorRole="muted">
                          aisle {idx}
                        </Typography>
                        <div className="h-px flex-1 border-t border-dashed border-border-primary" />
                      </div>
                    )}

                    {/* Aisle label + bay cells */}
                    <div className="flex items-center gap-2">
                      <div className="w-8 text-center">
                        <Typography variant="headingSm" className="text-purple-600">
                          {aisle}
                        </Typography>
                        {aisleCases > 0 && (
                          <Typography variant="bodyXs" colorRole="muted">
                            {aisleCases}
                          </Typography>
                        )}
                      </div>

                      <div className="flex flex-1 gap-1.5">
                        {bays.map((bay) => {
                          const key = `${bay.aisle}-${bay.bay}`;
                          const isSelected = selectedBay === key;
                          const hasStock = bay.totalCases > 0;

                          return (
                            <button
                              key={key}
                              onClick={() => handleBayTap(bay.aisle, bay.bay)}
                              className={`flex flex-1 flex-col items-center justify-center rounded-lg border-2 p-2 transition-all ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-50 shadow-sm dark:border-purple-400 dark:bg-purple-900/30'
                                  : hasStock
                                    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20'
                                    : 'border-border-primary bg-fill-secondary'
                              }`}
                            >
                              <Typography variant="bodyXs" className="font-bold">
                                {bay.bay}
                              </Typography>
                              {hasStock && (
                                <Typography variant="bodyXs" className="text-emerald-600 dark:text-emerald-400">
                                  {bay.totalCases}
                                </Typography>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border-primary pt-3">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded border-2 border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20" />
                <Typography variant="bodyXs" colorRole="muted">
                  Has stock
                </Typography>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded border-2 border-border-primary bg-fill-secondary" />
                <Typography variant="bodyXs" colorRole="muted">
                  Empty
                </Typography>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded border-2 border-purple-500 bg-purple-50 dark:border-purple-400 dark:bg-purple-900/30" />
                <Typography variant="bodyXs" colorRole="muted">
                  Selected
                </Typography>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Elevation View - Visual Racking */}
        {selectedBayGroup && (
          <Card>
            <CardContent className="p-4">
              {/* Bay header */}
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <Typography variant="headingSm">
                    Bay {selectedBayGroup.aisle}-{selectedBayGroup.bay}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Side elevation · {selectedBayGroup.totalCases} cases · {selectedBayGroup.totalProducts} products
                  </Typography>
                </div>
                <button
                  onClick={() => { setSelectedBay(null); setExpandedLevel(null); }}
                  className="rounded-lg p-2 text-text-muted transition-colors hover:bg-fill-secondary"
                >
                  <IconChevronUp className="h-5 w-5" />
                </button>
              </div>

              {/* Visual racking structure */}
              <div className="flex gap-2">
                {/* Level labels (left side) */}
                <div className="flex flex-col-reverse gap-0">
                  {selectedBayGroup.levels
                    .slice()
                    .sort((a, b) => a.level.localeCompare(b.level))
                    .map((level) => {
                      const isPallet = level.storageMethod === 'pallet';
                      return (
                        <div
                          key={`label-${level.id}`}
                          className="flex flex-col items-center justify-center"
                          style={{ height: isPallet ? 100 : 72 }}
                        >
                          <Typography variant="bodyXs" className="font-mono font-bold">
                            {level.level}
                          </Typography>
                          {isPallet ? (
                            <IconForklift className="h-3.5 w-3.5 text-amber-500" />
                          ) : (
                            <IconBox className="h-3.5 w-3.5 text-blue-500" />
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* Racking frame + shelves */}
                <div className="flex flex-1 flex-col-reverse rounded border-2 border-stone-400 dark:border-stone-600">
                  {selectedBayGroup.levels
                    .slice()
                    .sort((a, b) => a.level.localeCompare(b.level))
                    .map((level, idx) => {
                      const isExpanded = expandedLevel === level.id;
                      const hasStock = level.totalCases > 0;
                      const isPallet = level.storageMethod === 'pallet';
                      const isTop = idx === selectedBayGroup.levels.length - 1;
                      const fillPercent = hasStock ? Math.min(100, Math.max(15, (level.totalCases / 50) * 100)) : 0;

                      return (
                        <button
                          key={level.id}
                          onClick={() => handleLevelTap(level.id)}
                          className={`relative flex items-end transition-colors ${
                            !isTop ? 'border-t-[3px] border-stone-400 dark:border-stone-600' : ''
                          } ${
                            isExpanded
                              ? 'ring-2 ring-inset ring-purple-500 dark:ring-purple-400'
                              : ''
                          }`}
                          style={{ height: isPallet ? 100 : 72 }}
                        >
                          {/* Stock fill bar (bottom-aligned like boxes on a shelf) */}
                          {hasStock && (
                            <div
                              className="absolute inset-x-0 bottom-0 bg-emerald-100 dark:bg-emerald-900/30"
                              style={{ height: `${fillPercent}%` }}
                            />
                          )}

                          {/* Level content overlay */}
                          <div className="relative z-10 flex w-full items-center justify-between px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <Typography variant="bodyXs" className="font-mono font-semibold" colorRole="muted">
                                {selectedBayGroup.aisle}-{selectedBayGroup.bay}-{level.level}
                              </Typography>
                              {isPallet ? (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                  PALLET
                                </span>
                              ) : (
                                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                  SHELF
                                </span>
                              )}
                            </div>
                            {hasStock ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                  {level.totalCases} cs
                                </span>
                                <span className="text-[10px] text-text-muted">
                                  {level.productCount} SKU
                                </span>
                                <Icon
                                  icon={isExpanded ? IconChevronUp : IconChevronDown}
                                  size="sm"
                                  colorRole="muted"
                                />
                              </div>
                            ) : (
                              <span className="text-xs italic text-text-muted">empty</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Concrete floor */}
              <div className="mt-1 h-2 rounded-b bg-stone-300 dark:bg-stone-700" />

              {/* Stock detail panel (below the racking) */}
              {expandedLevel && (
                <div className="mt-4 rounded-lg border border-border-primary bg-fill-secondary p-4">
                  {isLoadingDetail ? (
                    <div className="flex items-center justify-center py-4">
                      <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="md" />
                    </div>
                  ) : levelDetail?.stock && levelDetail.stock.length > 0 ? (
                    <div className="space-y-2">
                      <Typography variant="bodyXs" className="font-semibold uppercase tracking-wide" colorRole="muted">
                        {levelDetail.locationCode} — {levelDetail.stock.length} items
                      </Typography>
                      {levelDetail.stock.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-lg bg-fill-primary p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <Typography variant="bodySm" className="font-medium truncate">
                              {item.productName || 'Unknown Product'}
                            </Typography>
                            <div className="flex flex-wrap items-center gap-2">
                              <Typography variant="bodyXs" colorRole="muted" className="font-mono">
                                {item.lwin18}
                              </Typography>
                              {item.vintage && (
                                <Badge colorRole="muted" size="sm">
                                  {item.vintage}
                                </Badge>
                              )}
                              {item.ownerName && (
                                <Typography variant="bodyXs" colorRole="muted">
                                  {item.ownerName}
                                </Typography>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 pl-3 text-right">
                            <Typography variant="headingSm" className="text-emerald-600 dark:text-emerald-400">
                              {item.quantityCases}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              cases
                            </Typography>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Typography variant="bodySm" colorRole="muted" className="py-2 text-center">
                      No stock at this location
                    </Typography>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Empty state when no bay selected */}
        {!selectedBay && !isLoading && (
          <Card>
            <CardContent className="p-6 text-center">
              <Icon icon={IconBuildingWarehouse} size="xl" colorRole="muted" className="mx-auto mb-3" />
              <Typography variant="bodySm" colorRole="muted">
                Tap a bay above to view levels and stock
              </Typography>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BinMapPage;
