'use client';

import {
  IconBox,
  IconCheck,
  IconClock,
  IconLoader2,
  IconPackage,
  IconPlane,
  IconTruck,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import { StockSourceBadge } from './StockStatusBadge';
import describePcoLine from '../utils/describePcoLine';

type StockStatus =
  | 'pending'
  | 'confirmed'
  | 'in_transit_to_cc'
  | 'at_cc_bonded'
  | 'at_cc_ready_for_dispatch'
  | 'in_transit_to_distributor'
  | 'at_distributor'
  | 'delivered';

interface LineItem {
  id: string;
  productName: string;
  vintage: string | number | null;
  quantity: number;
  /** Bottles per case and bottle size, so a single bottle reads as one */
  caseConfig?: number | null;
  bottleSize?: string | null;
  source: 'cc_inventory' | 'partner_airfreight' | 'partner_local' | 'manual' | null;
  stockStatus: StockStatus | null;
  stockExpectedAt: Date | string | null;
  stockConfirmedAt: Date | string | null;
  stockNotes: string | null;
}

export interface StockManagementSectionProps {
  orderId: string;
  items: LineItem[];
  onUpdated?: () => void;
  className?: string;
  /** Statuses to exclude from selection (e.g., 'at_distributor' for admin - distributor action only) */
  excludeStatuses?: StockStatus[];
}

const stockStatusOptions: { value: StockStatus; label: string; icon: React.ReactNode }[] = [
  { value: 'pending', label: 'Sourcing', icon: <IconClock size={14} /> },
  { value: 'confirmed', label: 'Confirmed', icon: <IconCheck size={14} /> },
  { value: 'in_transit_to_cc', label: 'In Air', icon: <IconPlane size={14} /> },
  { value: 'at_cc_bonded', label: 'At C&C', icon: <IconBox size={14} /> },
  { value: 'at_cc_ready_for_dispatch', label: 'Packed', icon: <IconPackage size={14} /> },
  { value: 'in_transit_to_distributor', label: 'To Distributor', icon: <IconTruck size={14} /> },
  { value: 'at_distributor', label: 'Ready', icon: <IconPackage size={14} /> },
  { value: 'delivered', label: 'Delivered', icon: <IconCheck size={14} /> },
];

const bulkStatusOptions: { value: StockStatus; label: string; description: string }[] = [
  { value: 'confirmed', label: 'Confirmed', description: 'Supplier confirmed stock' },
  { value: 'in_transit_to_cc', label: 'In Air', description: 'Shipment in transit to UAE' },
  { value: 'at_cc_bonded', label: 'At C&C', description: 'Arrived at C&C warehouse' },
  { value: 'at_cc_ready_for_dispatch', label: 'Packed', description: 'Packed and ready for dispatch' },
  { value: 'in_transit_to_distributor', label: 'To Distributor', description: 'In transit to distributor' },
  { value: 'at_distributor', label: 'Ready', description: 'Ready for delivery' },
];

/**
 * Admin Stock Management Section
 *
 * Allows admins to update stock status for each line item in an order.
 * Includes per-item status updates and bulk actions.
 */
const StockManagementSection = ({
  orderId,
  items,
  onUpdated,
  className,
  excludeStatuses = [],
}: StockManagementSectionProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [editingETA, setEditingETA] = useState<Record<string, string>>({});

  // Filter out excluded statuses from bulk options only
  // For individual item selects, we need to include the current status even if excluded
  const filteredBulkOptions = bulkStatusOptions.filter(
    (opt) => !excludeStatuses.includes(opt.value),
  );

  /**
   * Get status options for a specific item
   * Always includes the current status even if it's in excludeStatuses
   * This prevents empty dropdowns when an item has an excluded status
   */
  const getStatusOptionsForItem = (currentStatus: StockStatus) => {
    return stockStatusOptions.filter(
      (opt) => !excludeStatuses.includes(opt.value) || opt.value === currentStatus,
    );
  };

  // Update single item stock status (admin only)
  const updateStockStatusMutation = useMutation(
    api.privateClientOrders.itemsUpdateStockStatus.mutationOptions({
      onSuccess: () => {
        toast.success('Stock status updated');
        void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
        onUpdated?.();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to update stock status');
      },
    }),
  );

  // Bulk update stock status (admin only)
  const bulkUpdateMutation = useMutation(
    api.privateClientOrders.itemsBulkUpdateStockStatus.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Updated ${data.updatedCount} line${data.updatedCount === 1 ? '' : 's'}`);
        void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
        onUpdated?.();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to bulk update stock status');
      },
    }),
  );

  const isUpdating = updateStockStatusMutation.isPending;
  const isBulkUpdating = bulkUpdateMutation.isPending;

  const handleStatusChange = (itemId: string, newStatus: StockStatus) => {
    const eta = editingETA[itemId];
    const notes = editingNotes[itemId];

    updateStockStatusMutation.mutate({
      itemId,
      stockStatus: newStatus,
      stockExpectedAt: eta ? new Date(eta) : undefined,
      stockNotes: notes || undefined,
    });
  };

  const handleBulkUpdate = (status: StockStatus) => {
    const itemIds = items
      .filter((item) => item.stockStatus !== status)
      .map((item) => item.id);

    if (itemIds.length === 0) {
      toast.info('All lines already have this status');
      return;
    }

    // Moves every line at once, so it is asked first
    const label = bulkStatusOptions.find((opt) => opt.value === status)?.label ?? status;
    if (!window.confirm(`Set ${itemIds.length} line${itemIds.length === 1 ? '' : 's'} to "${label}"?`)) {
      return;
    }

    bulkUpdateMutation.mutate({
      orderId,
      itemIds,
      stockStatus: status,
    });
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateForInput = (date: Date | string | null) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  // Calculate summary
  const statusCounts = items.reduce(
    (acc, item) => {
      const status = item.stockStatus ?? 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const readyCount =
    (statusCounts['at_distributor'] || 0) + (statusCounts['delivered'] || 0);
  const inTransitCount =
    (statusCounts['at_cc_bonded'] || 0) +
    (statusCounts['at_cc_ready_for_dispatch'] || 0) +
    (statusCounts['in_transit_to_cc'] || 0) +
    (statusCounts['in_transit_to_distributor'] || 0);
  const pendingCount =
    (statusCounts['pending'] || 0) + (statusCounts['confirmed'] || 0);

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Typography variant="headingSm">Stock</Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Where each line&apos;s stock is, from sourcing to the distributor
            </Typography>
          </div>

          {/* Summary badges */}
          {/* Line counts by stage; dark-mode tints as elsewhere in the app */}
          <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
              {readyCount} ready
            </span>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              {inTransitCount} in transit
            </span>
            <span className="rounded-full bg-fill-muted px-2 py-0.5 font-medium text-text-muted">
              {pendingCount} pending
            </span>
          </div>
        </div>

        {/* Set every line at once: a quiet toolbar, not a boxed form */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5 border-b border-border-muted pb-3">
          <Typography variant="bodyXs" colorRole="muted" className="mr-1">
            Set all lines to
          </Typography>
          {filteredBulkOptions.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant="ghost"
              size="xs"
              shape="pill"
              onClick={() => handleBulkUpdate(opt.value)}
              disabled={isBulkUpdating}
              title={opt.description}
            >
              {isBulkUpdating ? (
                <Icon icon={IconLoader2} size="xs" className="animate-spin" />
              ) : null}
              {opt.label}
            </Button>
          ))}
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="hidden md:table-header-group border-b border-border-muted bg-surface-secondary/50">
              <tr>
                <th className="px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  Product
                </th>
                <th className="px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  Qty
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  Source
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  Status
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  ETA
                </th>
                <th className="px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted/50">
              {items.map((item) => {
                const isExpanded = expandedItem === item.id;
                const currentStatus = item.stockStatus ?? 'pending';

                return (
                  <React.Fragment key={item.id}>
                    <tr className="hidden hover:bg-surface-muted/20 md:table-row">
                      <td className="max-w-[18rem] px-2 py-2">
                        <div className="truncate font-medium" title={item.productName}>{item.productName}</div>
                        {item.vintage && (
                          <span className="text-text-muted">{item.vintage}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-center font-medium tabular-nums">
                        {describePcoLine(item).count}
                      </td>
                      <td className="px-2 py-2">
                        {item.source ? (
                          <StockSourceBadge source={item.source} className="text-text-muted dark:text-text-muted" />
                        ) : (
                          <span className="text-text-muted">-</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <Select
                          value={currentStatus}
                          onValueChange={(v) =>
                            handleStatusChange(item.id, v as StockStatus)
                          }
                          disabled={isUpdating}
                        >
                          <SelectTrigger className="h-7 w-[140px] text-xs" aria-label={`Stock status of ${item.productName}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getStatusOptionsForItem(currentStatus).map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <div className="flex items-center gap-2">
                                  {opt.icon}
                                  <span>{opt.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-2">
                        {/* Show ETA for pending/confirmed/in_transit - hide once stock has arrived */}
                        {item.stockExpectedAt &&
                        ['pending', 'confirmed', 'in_transit_to_cc'].includes(currentStatus) ? (
                          <span className="text-text-muted">
                            {formatDate(item.stockExpectedAt)}
                          </span>
                        ) : (
                          <span className="text-text-muted/50">-</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          aria-expanded={isExpanded}
                          onClick={() =>
                            setExpandedItem(isExpanded ? null : item.id)
                          }
                        >
                          {isExpanded ? 'Close' : 'Edit'}
                        </Button>
                      </td>
                    </tr>
                    {/* The phone's version of this row: status changes in place, Edit opens the same panel */}
                    <tr className="md:hidden">
                      <td colSpan={6} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-text-primary">{item.productName}</div>
                            <div className="mt-0.5 text-xs text-text-muted">
                              {[
                                item.vintage,
                                describePcoLine(item).count,
                                item.stockExpectedAt && ['pending', 'confirmed', 'in_transit_to_cc'].includes(currentStatus)
                                  ? `ETA ${formatDate(item.stockExpectedAt)}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </div>
                          {item.source ? (
                            <StockSourceBadge source={item.source} className="shrink-0 text-text-muted dark:text-text-muted" />
                          ) : null}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Select
                            value={currentStatus}
                            onValueChange={(v) => handleStatusChange(item.id, v as StockStatus)}
                            disabled={isUpdating}
                          >
                            <SelectTrigger className="h-10 flex-1 text-sm" aria-label={`Stock status of ${item.productName}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getStatusOptionsForItem(currentStatus).map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <div className="flex items-center gap-2">
                                    {opt.icon}
                                    <span>{opt.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" onClick={() => setExpandedItem(isExpanded ? null : item.id)}>
                            {isExpanded ? 'Close' : 'Edit'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-surface-muted/30">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <Typography
                                variant="labelSm"
                                colorRole="muted"
                                className="mb-1"
                              >
                                Expected arrival
                              </Typography>
                              <Input
                                type="date"
                                aria-label="Expected arrival"
                                value={
                                  editingETA[item.id] ??
                                  formatDateForInput(item.stockExpectedAt)
                                }
                                onChange={(e) =>
                                  setEditingETA({
                                    ...editingETA,
                                    [item.id]: e.target.value,
                                  })
                                }
                                className="h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Typography
                                variant="labelSm"
                                colorRole="muted"
                                className="mb-1"
                              >
                                Notes
                              </Typography>
                              <Input
                                value={
                                  editingNotes[item.id] ?? item.stockNotes ?? ''
                                }
                                onChange={(e) =>
                                  setEditingNotes({
                                    ...editingNotes,
                                    [item.id]: e.target.value,
                                  })
                                }
                                placeholder="Add stock notes..."
                                aria-label="Stock notes"
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setExpandedItem(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                const etaValue = editingETA[item.id];
                                updateStockStatusMutation.mutate({
                                  itemId: item.id,
                                  stockStatus: currentStatus,
                                  stockExpectedAt: etaValue
                                    ? new Date(etaValue)
                                    : undefined,
                                  stockNotes: editingNotes[item.id] || undefined,
                                });
                                setExpandedItem(null);
                              }}
                              disabled={isUpdating}
                            >
                              {isUpdating ? (
                                <Icon
                                  icon={IconLoader2}
                                  size="xs"
                                  className="animate-spin"
                                />
                              ) : (
                                <Icon icon={IconCheck} size="xs" />
                              )}
                              Save
                            </Button>
                          </div>
                          {item.stockConfirmedAt && (
                            <Typography
                              variant="bodyXs"
                              colorRole="muted"
                              className="mt-2"
                            >
                              Confirmed: {formatDate(item.stockConfirmedAt)}
                            </Typography>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default StockManagementSection;
