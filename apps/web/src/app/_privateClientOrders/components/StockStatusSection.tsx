'use client';

import { IconCheck, IconChevronDown, IconChevronUp, IconClock, IconPackage } from '@tabler/icons-react';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';

import StockStatusBadge, { StockSourceBadge } from './StockStatusBadge';

interface LineItem {
  id: string;
  productName: string;
  vintage: number | string | null;
  quantity: number;
  source: 'cc_inventory' | 'partner_airfreight' | 'partner_local' | 'manual' | null;
  stockStatus: string | null;
  stockExpectedAt: Date | null;
  stockConfirmedAt: Date | null;
}

export interface StockStatusSectionProps {
  items: LineItem[];
  className?: string;
}

type StockStatus = 'pending' | 'confirmed' | 'at_cc_bonded' | 'in_transit_to_cc' | 'at_distributor' | 'delivered';

/**
 * Stock Status Section for order detail pages
 *
 * Ultra-compact summary bar with optional expandable detail.
 * Designed to scale to 20+ items efficiently.
 */
const StockStatusSection = ({ items, className }: StockStatusSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!items || items.length === 0) {
    return null;
  }

  // Calculate summary stats with clear categories
  const totalItems = items.length;

  // At distributor = ready for delivery
  const atDistributorItems = items.filter(
    (i) => i.stockStatus === 'at_distributor' || i.stockStatus === 'delivered',
  ).length;

  // At C&C = arrived in UAE, being processed
  const atCCItems = items.filter(
    (i) => i.stockStatus === 'at_cc_bonded',
  ).length;

  // In transit = on the way to UAE
  const inTransitItems = items.filter(
    (i) => i.stockStatus === 'in_transit_to_cc',
  ).length;

  // Awaiting stock = confirmed supplier but not shipped yet
  const confirmedItems = items.filter(
    (i) => i.stockStatus === 'confirmed',
  ).length;

  // Sourcing = still finding/ordering stock
  const sourcingItems = items.filter(
    (i) => i.stockStatus === 'pending' || !i.stockStatus,
  ).length;

  // Find latest ETA for pending items
  const pendingETAs = items
    .filter((i) => i.stockExpectedAt && (i.stockStatus === 'pending' || i.stockStatus === 'confirmed' || !i.stockStatus))
    .map((i) => i.stockExpectedAt!)
    .sort((a, b) => b.getTime() - a.getTime());
  const latestETA = pendingETAs[0];

  // Calculate progress percentage (at distributor = ready for delivery)
  const progressPercent = totalItems > 0 ? Math.round((atDistributorItems / totalItems) * 100) : 0;
  const allReady = atDistributorItems === totalItems;

  // Sort items by status for detail view
  const statusOrder: Record<string, number> = {
    pending: 0,
    confirmed: 1,
    in_transit_to_cc: 2,
    at_cc_bonded: 3,
    at_distributor: 4,
    delivered: 5,
  };
  const sortedItems = [...items].sort((a, b) => {
    const aOrder = statusOrder[a.stockStatus ?? 'pending'] ?? 0;
    const bOrder = statusOrder[b.stockStatus ?? 'pending'] ?? 0;
    return aOrder - bOrder;
  });

  return (
    <div className={className}>
      {/* Ultra-compact summary bar */}
      <div
        className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
          allReady
            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
            : 'border-border-muted bg-surface-secondary'
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className={`flex h-6 w-6 items-center justify-center rounded-full ${
            allReady ? 'bg-green-500' : 'bg-fill-muted'
          }`}>
            {allReady ? (
              <IconCheck size={14} className="text-white" />
            ) : (
              <IconPackage size={14} className="text-text-muted" />
            )}
          </div>

          {/* Progress bar + stats */}
          <div className="flex items-center gap-3">
            {/* Mini progress bar */}
            <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 sm:block">
              <div
                className={`h-full transition-all ${allReady ? 'bg-green-500' : 'bg-fill-brand'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Counts - clear state descriptions */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {atDistributorItems > 0 && (
                <span className="font-medium text-green-700 dark:text-green-300">
                  {atDistributorItems} at distributor
                </span>
              )}
              {atCCItems > 0 && (
                <span className="text-purple-600 dark:text-purple-400">
                  {atCCItems} at C&C
                </span>
              )}
              {inTransitItems > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {inTransitItems} in transit
                </span>
              )}
              {confirmedItems > 0 && (
                <span className="text-blue-600 dark:text-blue-400">
                  {confirmedItems} confirmed
                </span>
              )}
              {sourcingItems > 0 && (
                <span className="text-text-muted">
                  {sourcingItems} sourcing
                </span>
              )}
              {allReady && (
                <span className="font-medium text-green-700 dark:text-green-300">
                  All {totalItems} at distributor
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ETA + expand toggle */}
        <div className="flex items-center gap-2">
          {latestETA && !allReady && (
            <div className="flex items-center gap-1 text-xs text-text-muted">
              <IconClock size={12} />
              <span className="hidden sm:inline">ETA:</span>
              <span>{latestETA.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 p-0"
          >
            {isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          </Button>
        </div>
      </div>

      {/* Expandable detail table */}
      {isExpanded && (
        <div className="mt-2 overflow-x-auto rounded-lg border border-border-muted">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-muted bg-surface-secondary text-left">
                <th className="px-3 py-1.5 font-medium text-text-muted">Product</th>
                <th className="w-10 px-2 py-1.5 text-center font-medium text-text-muted">Qty</th>
                <th className="w-20 px-2 py-1.5 font-medium text-text-muted">Source</th>
                <th className="w-24 px-2 py-1.5 font-medium text-text-muted">Status</th>
                <th className="w-16 px-2 py-1.5 text-right font-medium text-text-muted">ETA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted/50">
              {sortedItems.map((item) => {
                const status = (item.stockStatus ?? 'pending') as StockStatus;
                const showETA = item.stockExpectedAt && (status === 'pending' || status === 'confirmed');

                return (
                  <tr key={item.id} className="hover:bg-surface-secondary/50">
                    <td className="px-3 py-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="truncate font-medium text-text-primary max-w-[180px]">
                          {item.productName}
                        </span>
                        {item.vintage && (
                          <span className="shrink-0 text-text-muted">{item.vintage}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1 text-center text-text-primary">
                      {item.quantity}
                    </td>
                    <td className="px-2 py-1">
                      {item.source && <StockSourceBadge source={item.source} showIcon={false} />}
                    </td>
                    <td className="px-2 py-1">
                      <StockStatusBadge status={status} showIcon={false} />
                    </td>
                    <td className="px-2 py-1 text-right text-text-muted">
                      {showETA
                        ? item.stockExpectedAt!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StockStatusSection;
