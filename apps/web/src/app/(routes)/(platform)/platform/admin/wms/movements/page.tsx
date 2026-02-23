'use client';

import {
  IconArrowLeft,
  IconArrowRight,
  IconBoxSeam,
  IconFilter,
  IconLoader2,
  IconTransfer,
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
import LocationBadge from '@/app/_wms/components/LocationBadge';
import MovementTypeBadge from '@/app/_wms/components/MovementTypeBadge';
import useTRPC from '@/lib/trpc/browser';

type MovementType =
  | 'receive'
  | 'putaway'
  | 'transfer'
  | 'pick'
  | 'adjust'
  | 'count'
  | 'ownership_transfer'
  | 'repack_out'
  | 'repack_in'
  | 'pallet_add'
  | 'pallet_remove'
  | 'pallet_move'
  | 'pallet_unseal'
  | 'pallet_dissolve'
  | 'pallet_dispatch';

/**
 * WMS Movement History - audit trail of all warehouse operations
 */
const WMSMovementsPage = () => {
  const api = useTRPC();
  const [filterType, setFilterType] = useState<MovementType | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery({
    ...api.wms.admin.stock.getMovements.queryOptions({
      movementType: filterType,
      limit: 100,
    }),
  });

  const movementTypes: { value: MovementType | undefined; label: string }[] = [
    { value: undefined, label: 'All Types' },
    { value: 'receive', label: 'Received' },
    { value: 'putaway', label: 'Put Away' },
    { value: 'transfer', label: 'Transfer' },
    { value: 'pick', label: 'Picked' },
    { value: 'adjust', label: 'Adjusted' },
    { value: 'count', label: 'Count' },
    { value: 'repack_out', label: 'Repack Out' },
    { value: 'repack_in', label: 'Repack In' },
    { value: 'pallet_add', label: 'Pallet Add' },
    { value: 'pallet_remove', label: 'Pallet Remove' },
    { value: 'pallet_move', label: 'Pallet Move' },
    { value: 'pallet_unseal', label: 'Pallet Unseal' },
    { value: 'pallet_dissolve', label: 'Pallet Dissolve' },
    { value: 'pallet_dispatch', label: 'Pallet Dispatch' },
  ];

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFullDate = (date: Date) => {
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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
              Movements
            </Typography>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <ButtonContent iconLeft={IconFilter}>
                {filterType ? 'Filtered' : 'Filter'}
              </ButtonContent>
            </Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card>
            <CardContent className="p-4">
              <Typography variant="bodySm" className="mb-3 font-medium">
                Filter by Type
              </Typography>
              <div className="flex flex-wrap gap-2">
                {movementTypes.map((type) => (
                  <button
                    key={type.value ?? 'all'}
                    onClick={() => setFilterType(type.value)}
                    className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      filterType === type.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-fill-secondary text-text-primary hover:bg-fill-tertiary'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary stats */}
        {data?.summary && data.summary.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.summary.slice(0, 6).map((stat) => (
              <div
                key={stat.movementType}
                className="flex items-center gap-2 rounded-lg bg-fill-secondary px-3 py-2"
              >
                <MovementTypeBadge
                  movementType={stat.movementType as MovementType}
                  size="sm"
                  showLabel={false}
                />
                <Typography variant="bodySm" className="font-medium">
                  {stat.count}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  ({stat.totalCases} cs)
                </Typography>
              </div>
            ))}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
          </div>
        )}

        {/* Movement list */}
        {!isLoading && data && (
          <div className="grid gap-2 md:grid-cols-2">
            {data.movements.length === 0 ? (
              <Card className="md:col-span-2">
                <CardContent className="p-8 text-center">
                  <Icon icon={IconTransfer} size="xl" colorRole="muted" className="mx-auto mb-4" />
                  <Typography variant="headingSm" className="mb-2">
                    No Movements Found
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    {filterType
                      ? 'No movements match your filter criteria'
                      : 'Stock movements will appear here'}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              data.movements.map((movement) => {
                const isPallet = movement.notes?.includes('(pallet)');
                return (
                <Card key={movement.id} className={`hover:border-border-brand ${isPallet ? 'border-l-4 border-l-indigo-500' : ''}`}>
                  {isPallet && (
                    <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2">
                      <IconBoxSeam size={20} className="text-indigo-600" />
                      <span className="text-sm font-bold text-indigo-700">PALLET</span>
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <MovementTypeBadge
                            movementType={movement.movementType as MovementType}
                            size="sm"
                          />
                          <Typography variant="bodySm" className="font-mono text-text-muted">
                            {movement.movementNumber}
                          </Typography>
                        </div>
                        <Typography variant="headingSm">{movement.productName}</Typography>
                        <Typography variant="bodyXs" colorRole="muted" className="mt-1 font-mono">
                          {movement.lwin18}
                        </Typography>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Location flow */}
                        <div className="flex items-center gap-2">
                          {movement.fromLocationCode ? (
                            <LocationBadge locationCode={movement.fromLocationCode} size="sm" />
                          ) : (
                            <span className="rounded bg-fill-secondary px-2 py-1 text-xs text-text-muted">
                              —
                            </span>
                          )}
                          <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
                          {movement.toLocationCode ? (
                            <LocationBadge locationCode={movement.toLocationCode} size="sm" />
                          ) : (
                            <span className="rounded bg-fill-secondary px-2 py-1 text-xs text-text-muted">
                              —
                            </span>
                          )}
                        </div>

                        {/* Quantity */}
                        <div className="text-right">
                          <Typography variant="headingSm" className="text-blue-600">
                            {movement.quantityCases}
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            cases
                          </Typography>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border-primary pt-3 text-xs text-text-muted">
                      <span title={formatFullDate(movement.performedAt)}>
                        {formatDate(movement.performedAt)}
                      </span>
                      {movement.performedBy?.name && (
                        <span>by {movement.performedBy.name}</span>
                      )}
                      {movement.lotNumber && <span>Lot: {movement.lotNumber}</span>}
                      {movement.notes && (
                        <span className="italic">&ldquo;{movement.notes}&rdquo;</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
                );
              })
            )}

            {/* Pagination info */}
            {data.pagination.total > 0 && (
              <Typography variant="bodyXs" colorRole="muted" className="text-center">
                Showing {data.movements.length} of {data.pagination.total} movements
              </Typography>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WMSMovementsPage;
