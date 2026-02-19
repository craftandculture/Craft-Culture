'use client';

import {
  IconArrowLeft,
  IconBox,
  IconForklift,
  IconLoader2,
  IconMapPin,
  IconPackages,
  IconPlus,
  IconPrinter,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
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
 * WMS Locations List - view and manage warehouse locations
 *
 * Groups locations by aisle and bay for easier navigation.
 */
const LocationsPage = () => {
  const api = useTRPC();
  const [search, setSearch] = useState('');
  const [filterAisle, setFilterAisle] = useState<string>('');

  const { data: locations, isLoading } = useQuery({
    ...api.wms.admin.locations.getMany.queryOptions({
      aisle: filterAisle || undefined,
      search: search || undefined,
    }),
  });

  // Get unique aisles for filter
  const aisles = useMemo(() => {
    if (!locations) return [];
    const uniqueAisles = [...new Set(locations.map((l) => l.aisle).filter((a) => a !== '-'))];
    return uniqueAisles.sort();
  }, [locations]);

  // Group locations into special + bay groups
  const { specialLocations, aisleGroups } = useMemo(() => {
    if (!locations) return { specialLocations: [] as LocationData[], aisleGroups: new Map<string, BayGroup[]>() };

    const special: LocationData[] = [];
    const bayMap = new Map<string, BayGroup>();

    for (const loc of locations) {
      if (loc.locationType !== 'rack') {
        special.push(loc);
        continue;
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

    // Sort levels within each bay (descending so top level is first)
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

    return { specialLocations: special, aisleGroups: grouped };
  }, [locations]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'receiving':
        return 'success';
      case 'shipping':
        return 'warning';
      default:
        return 'muted';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-6">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  const sortedAisles = [...aisleGroups.keys()].sort();

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
              Locations
            </Typography>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm">
                <Link href="/platform/admin/wms/locations/new">
                  <ButtonContent iconLeft={IconPlus}>Add</ButtonContent>
                </Link>
              </Button>
              <Button variant="outline" size="sm">
                <Icon icon={IconPrinter} size="sm" />
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <Icon
                  icon={IconSearch}
                  size="sm"
                  colorRole="muted"
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search locations..."
                  className="w-full pl-10 pr-4 py-2 text-sm bg-fill-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <Icon icon={IconX} size="sm" colorRole="muted" />
                  </button>
                )}
              </div>
              <select
                value={filterAisle}
                onChange={(e) => setFilterAisle(e.target.value)}
                className="px-3 py-2 text-sm bg-fill-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="">All Aisles</option>
                {aisles.map((aisle) => (
                  <option key={aisle} value={aisle}>
                    Aisle {aisle}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        {locations && locations.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <Typography variant="headingMd">
                  {locations.filter((l) => l.locationType === 'rack').length}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Rack Locations
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <Typography variant="headingMd">
                  {locations.filter((l) => l.storageMethod === 'shelf').length}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Shelf
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <Typography variant="headingMd">
                  {locations.filter((l) => l.storageMethod === 'pallet').length}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Pallet
                </Typography>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Special Locations */}
        {specialLocations.length > 0 && (
          <div className="space-y-2">
            <Typography variant="headingSm" colorRole="muted" className="px-1">
              Special Locations
            </Typography>
            <div className="grid grid-cols-2 gap-3">
              {specialLocations.map((loc) => (
                <Link key={loc.id} href={`/platform/admin/wms/locations/${loc.id}`}>
                  <Card className="transition-colors hover:bg-fill-secondary">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon icon={IconMapPin} size="sm" colorRole="muted" />
                        <Typography variant="headingXs">{loc.locationCode}</Typography>
                      </div>
                      <Badge colorRole={getTypeColor(loc.locationType)} size="sm">
                        {loc.locationType}
                      </Badge>
                      {loc.totalCases > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-text-muted">
                          <Icon icon={IconBox} size="sm" />
                          {loc.totalCases} cases
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Aisle Groups */}
        {sortedAisles.map((aisle) => {
          const bays = aisleGroups.get(aisle) ?? [];
          const aisleCases = bays.reduce((sum, b) => sum + b.totalCases, 0);

          return (
            <div key={aisle} className="space-y-3">
              <div className="flex items-baseline justify-between px-1">
                <Typography variant="headingSm">
                  Aisle {aisle}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  {bays.length} bays
                  {aisleCases > 0 && ` \u00b7 ${aisleCases} cases`}
                </Typography>
              </div>

              <div className="space-y-2">
                {bays.map((bay) => (
                  <Card key={`${bay.aisle}-${bay.bay}`}>
                    <CardContent className="p-0">
                      {/* Bay header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary bg-fill-secondary rounded-t-xl">
                        <div className="flex items-center gap-2">
                          <Typography variant="headingXs" className="font-mono">
                            Bay {bay.bay}
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            {bay.levels.length} levels
                          </Typography>
                        </div>
                        {bay.totalCases > 0 && (
                          <div className="flex items-center gap-1 text-xs text-text-muted">
                            <Icon icon={IconBox} size="sm" />
                            {bay.totalCases}
                          </div>
                        )}
                      </div>

                      {/* Levels */}
                      <div className="divide-y divide-border-primary">
                        {bay.levels.map((level) => (
                          <Link
                            key={level.id}
                            href={`/platform/admin/wms/locations/${level.id}`}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-fill-secondary transition-colors"
                          >
                            {/* Level number */}
                            <span className="font-mono text-sm font-medium w-6 text-center">
                              {level.level}
                            </span>

                            {/* Storage badge */}
                            {level.storageMethod === 'pallet' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full min-w-[70px] justify-center">
                                <IconPackages className="h-3.5 w-3.5" />
                                Pallet
                              </span>
                            ) : level.storageMethod === 'shelf' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full min-w-[70px] justify-center">
                                <IconBox className="h-3.5 w-3.5" />
                                Shelf
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-xs text-text-muted min-w-[70px] justify-center">
                                -
                              </span>
                            )}

                            {/* Forklift indicator */}
                            {level.requiresForklift && (
                              <IconForklift className="h-4 w-4 text-orange-500" />
                            )}

                            {/* Spacer */}
                            <span className="flex-1" />

                            {/* Cases count */}
                            <span className="text-xs text-text-muted tabular-nums">
                              {level.totalCases > 0
                                ? `${level.totalCases} case${level.totalCases !== 1 ? 's' : ''}`
                                : 'empty'}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {(!locations || locations.length === 0) && (
          <Card>
            <CardContent className="p-8 text-center">
              <Icon icon={IconMapPin} size="xl" colorRole="muted" className="mx-auto mb-4" />
              <Typography variant="headingSm" className="mb-2">
                No Locations Found
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-4">
                {search || filterAisle
                  ? 'No locations match your filters'
                  : 'Create your first warehouse location'}
              </Typography>
              {!search && !filterAisle && (
                <Button asChild>
                  <Link href="/platform/admin/wms/locations/new">
                    <ButtonContent iconLeft={IconPlus}>Create Locations</ButtonContent>
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LocationsPage;
