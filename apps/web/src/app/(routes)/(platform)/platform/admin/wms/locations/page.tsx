'use client';

import {
  IconArrowLeft,
  IconBox,
  IconCheck,
  IconForklift,
  IconLoader2,
  IconMapPin,
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

/**
 * WMS Locations List - view and manage warehouse locations
 */
const LocationsPage = () => {
  const api = useTRPC();
  const [search, setSearch] = useState('');
  const [filterAisle, setFilterAisle] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');

  const { data: locations, isLoading } = useQuery({
    ...api.wms.admin.locations.getMany.queryOptions({
      aisle: filterAisle || undefined,
      locationType: filterType
        ? (filterType as 'rack' | 'floor' | 'receiving' | 'shipping')
        : undefined,
      search: search || undefined,
    }),
  });

  // Get unique aisles for filter dropdown
  const aisles = useMemo(() => {
    if (!locations) return [];
    const uniqueAisles = [...new Set(locations.map((l) => l.aisle).filter((a) => a !== '-'))];
    return uniqueAisles.sort();
  }, [locations]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'rack':
        return 'brand';
      case 'floor':
        return 'info';
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
      <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/platform/admin/wms">
                <Icon icon={IconArrowLeft} size="sm" />
              </Link>
            </Button>
            <div>
              <Typography variant="headingLg" className="mb-2">
                Warehouse Locations
              </Typography>
              <Typography variant="bodyMd" colorRole="muted">
                {locations?.length ?? 0} locations configured
              </Typography>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm">
              <ButtonContent iconLeft={IconPrinter}>Print Labels</ButtonContent>
            </Button>
            <Button asChild>
              <Link href="/platform/admin/wms/locations/new">
                <ButtonContent iconLeft={IconPlus}>Add Locations</ButtonContent>
              </Link>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
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
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 text-sm bg-fill-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="">All Types</option>
                <option value="rack">Rack</option>
                <option value="floor">Floor</option>
                <option value="receiving">Receiving</option>
                <option value="shipping">Shipping</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Locations Table */}
        <Card>
          <CardContent className="p-0">
            {!locations || locations.length === 0 ? (
              <div className="p-8 text-center">
                <Icon icon={IconMapPin} size="xl" colorRole="muted" className="mx-auto mb-4" />
                <Typography variant="headingSm" className="mb-2">
                  No Locations Found
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="mb-4">
                  {search || filterAisle || filterType
                    ? 'No locations match your filters'
                    : 'Create your first warehouse location'}
                </Typography>
                {!search && !filterAisle && !filterType && (
                  <Button asChild>
                    <Link href="/platform/admin/wms/locations/new">
                      <ButtonContent iconLeft={IconPlus}>Create Locations</ButtonContent>
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-primary bg-fill-secondary">
                      <th className="px-4 py-3 text-left font-medium text-text-muted">Location</th>
                      <th className="px-4 py-3 text-left font-medium text-text-muted">Type</th>
                      <th className="px-4 py-3 text-left font-medium text-text-muted hidden sm:table-cell">
                        Aisle
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-text-muted hidden md:table-cell">
                        Bay
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-text-muted hidden md:table-cell">
                        Level
                      </th>
                      <th className="px-4 py-3 text-center font-medium text-text-muted hidden lg:table-cell">
                        Forklift
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-text-muted">Cases</th>
                      <th className="px-4 py-3 text-right font-medium text-text-muted hidden sm:table-cell">
                        Products
                      </th>
                      <th className="px-4 py-3 text-center font-medium text-text-muted">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-primary">
                    {locations.map((location) => (
                      <tr
                        key={location.id}
                        className="hover:bg-fill-secondary transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/platform/admin/wms/locations/${location.id}`}
                            className="flex items-center gap-2"
                          >
                            <Icon icon={IconMapPin} size="sm" colorRole="muted" />
                            <span className="font-mono font-medium">{location.locationCode}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge colorRole={getTypeColor(location.locationType)} size="sm">
                            {location.locationType}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {location.aisle === '-' ? '-' : location.aisle}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {location.bay === '-' ? '-' : location.bay}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {location.level === '-' ? '-' : location.level}
                        </td>
                        <td className="px-4 py-3 text-center hidden lg:table-cell">
                          {location.requiresForklift ? (
                            <Icon icon={IconForklift} size="sm" className="text-orange-500 mx-auto" />
                          ) : (
                            <span className="text-text-muted">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Icon icon={IconBox} size="sm" colorRole="muted" />
                            <span>{location.totalCases}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell">
                          {location.productCount}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {location.isActive ? (
                            <Icon icon={IconCheck} size="sm" className="text-green-500 mx-auto" />
                          ) : (
                            <Icon icon={IconX} size="sm" className="text-red-500 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LocationsPage;
