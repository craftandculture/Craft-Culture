'use client';

import {
  IconBox,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconClock,
  IconPackage,
  IconPlane,
  IconSearch,
  IconTruck,
} from '@tabler/icons-react';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

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

type StockStatus =
  | 'pending'
  | 'confirmed'
  | 'in_transit_to_cc'
  | 'at_cc_bonded'
  | 'in_transit_to_distributor'
  | 'at_distributor'
  | 'delivered';

/**
 * Stock journey stages with descriptions for users
 */
const stockStages = [
  {
    key: 'pending',
    label: 'Sourcing',
    shortLabel: 'Sourcing',
    description: 'Finding stock from suppliers',
    icon: IconSearch,
    color: 'text-text-muted',
    bgColor: 'bg-fill-muted',
  },
  {
    key: 'confirmed',
    label: 'Confirmed',
    shortLabel: 'Confirmed',
    description: 'Order placed with supplier',
    icon: IconCheck,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500',
  },
  {
    key: 'in_transit_to_cc',
    label: 'In Air',
    shortLabel: 'In Air',
    description: 'In transit to Dubai',
    icon: IconPlane,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500',
  },
  {
    key: 'at_cc_bonded',
    label: 'At C&C',
    shortLabel: 'At C&C',
    description: 'At Dubai bonded warehouse',
    icon: IconBox,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500',
  },
  {
    key: 'in_transit_to_distributor',
    label: 'To Distributor',
    shortLabel: 'To Dist.',
    description: 'In transit to distributor',
    icon: IconTruck,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-500',
  },
  {
    key: 'at_distributor',
    label: 'Ready',
    shortLabel: 'Ready',
    description: 'Ready for delivery',
    icon: IconCheck,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500',
  },
] as const;

/**
 * Stock Tracking Section for order detail pages
 *
 * Shows the journey of stock from sourcing to delivery with clear visual stages.
 * Expandable to show per-item details.
 */
const StockStatusSection = ({ items, className }: StockStatusSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!items || items.length === 0) {
    return null;
  }

  // Calculate summary stats with clear categories
  const totalItems = items.length;

  // Count items at each stage
  const stageCounts: Record<string, number> = {
    pending: items.filter((i) => i.stockStatus === 'pending' || !i.stockStatus).length,
    confirmed: items.filter((i) => i.stockStatus === 'confirmed').length,
    in_transit_to_cc: items.filter((i) => i.stockStatus === 'in_transit_to_cc').length,
    at_cc_bonded: items.filter((i) => i.stockStatus === 'at_cc_bonded').length,
    in_transit_to_distributor: items.filter((i) => i.stockStatus === 'in_transit_to_distributor')
      .length,
    at_distributor: items.filter(
      (i) => i.stockStatus === 'at_distributor' || i.stockStatus === 'delivered',
    ).length,
  };

  // Find the furthest stage any item has reached (for highlighting current stage)
  const getCurrentStageIndex = () => {
    for (let i = stockStages.length - 1; i >= 0; i--) {
      const stage = stockStages[i];
      if (stage && (stageCounts[stage.key] ?? 0) > 0) return i;
    }
    return 0;
  };
  const currentStageIndex = getCurrentStageIndex();

  // Find latest ETA for items still in transit
  const pendingETAs = items
    .filter(
      (i) =>
        i.stockExpectedAt &&
        (i.stockStatus === 'pending' ||
          i.stockStatus === 'confirmed' ||
          i.stockStatus === 'in_transit_to_cc' ||
          !i.stockStatus),
    )
    .map((i) => i.stockExpectedAt!)
    .sort((a, b) => b.getTime() - a.getTime());
  const latestETA = pendingETAs[0];

  // Check if all items are ready
  const allReady = stageCounts['at_distributor'] === totalItems;

  // Sort items by status for detail view
  const statusOrder: Record<string, number> = {
    pending: 0,
    confirmed: 1,
    in_transit_to_cc: 2,
    at_cc_bonded: 3,
    in_transit_to_distributor: 4,
    at_distributor: 5,
    delivered: 6,
  };
  const sortedItems = [...items].sort((a, b) => {
    const aOrder = statusOrder[a.stockStatus ?? 'pending'] ?? 0;
    const bOrder = statusOrder[b.stockStatus ?? 'pending'] ?? 0;
    return aOrder - bOrder;
  });

  return (
    <div className={className}>
      {/* Main container */}
      <div
        className={`rounded-lg border ${
          allReady
            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
            : 'border-border-muted bg-surface-secondary'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                allReady ? 'bg-green-500' : 'bg-fill-muted'
              }`}
            >
              {allReady ? (
                <IconCheck size={16} className="text-white" />
              ) : (
                <IconPackage size={16} className="text-text-muted" />
              )}
            </div>
            <div>
              <Typography variant="labelMd">Stock Tracking</Typography>
              <Typography variant="bodyXs" colorRole="muted">
                {allReady
                  ? `All ${totalItems} items ready for delivery`
                  : `Tracking ${totalItems} items through the supply chain`}
              </Typography>
            </div>
          </div>

          {/* ETA indicator */}
          {latestETA && !allReady && (
            <div className="flex items-center gap-1.5 rounded-full bg-fill-muted/50 px-2.5 py-1">
              <IconClock size={12} className="text-text-muted" />
              <Typography variant="bodyXs" colorRole="muted">
                Est. Arrival: {latestETA.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Typography>
            </div>
          )}
        </div>

        {/* Stage Progress Pipeline */}
        <div className="px-4 pb-4">
          <div className="flex items-stretch gap-1">
            {stockStages.map((stage, index) => {
              const count = stageCounts[stage.key];
              const isActive = count > 0;
              const isPast = index < currentStageIndex;
              const isCurrent = index === currentStageIndex && !allReady;
              const isLast = index === stockStages.length - 1;

              return (
                <div key={stage.key} className="flex flex-1 items-stretch">
                  {/* Stage pill */}
                  <div
                    className={`flex flex-1 flex-col items-center rounded-lg px-2 py-3 transition-all ${
                      isActive
                        ? isCurrent
                          ? 'bg-surface-primary shadow-sm ring-1 ring-border-muted'
                          : 'bg-surface-primary/50'
                        : 'bg-surface-primary/30'
                    }`}
                  >
                    {/* Icon + Count */}
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full ${
                          isActive || isPast ? stage.bgColor : 'bg-fill-muted/30'
                        }`}
                      >
                        <Icon
                          icon={stage.icon}
                          size="sm"
                          className={isActive || isPast ? 'text-white' : 'text-text-muted/40'}
                        />
                      </div>
                      {isActive && (
                        <Typography variant="labelMd" className={stage.color}>
                          {count}
                        </Typography>
                      )}
                    </div>

                    {/* Label */}
                    <Typography
                      variant="labelXs"
                      className={`mt-1.5 text-center ${
                        isActive ? stage.color : 'text-text-muted/60'
                      }`}
                    >
                      {stage.shortLabel}
                    </Typography>

                    {/* Description - always visible */}
                    <Typography
                      variant="bodyXs"
                      className={`mt-0.5 hidden text-center leading-tight sm:block ${
                        isActive ? 'text-text-muted' : 'text-text-muted/40'
                      }`}
                    >
                      {stage.description}
                    </Typography>
                  </div>

                  {/* Connector line */}
                  {!isLast && (
                    <div className="flex items-center">
                      <div
                        className={`h-0.5 w-2 ${
                          isPast || (isActive && index < currentStageIndex)
                            ? 'bg-green-400'
                            : 'bg-border-muted/50'
                        }`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Expand button */}
        <div className="border-t border-border-muted/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full justify-center gap-2 rounded-none rounded-b-lg"
          >
            <Typography variant="bodyXs" colorRole="muted">
              {isExpanded ? 'Hide Details' : 'View Item Details'}
            </Typography>
            {isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          </Button>
        </div>
      </div>

      {/* Expandable detail table */}
      {isExpanded && (
        <div className="mt-2 overflow-x-auto rounded-lg border border-border-muted">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-muted bg-surface-secondary text-left">
                <th className="min-w-[240px] px-4 py-2.5 text-xs font-medium text-text-muted">
                  Product
                </th>
                <th className="w-14 px-3 py-2.5 text-center text-xs font-medium text-text-muted">
                  Qty
                </th>
                <th className="w-32 px-3 py-2.5 text-xs font-medium text-text-muted">Source</th>
                <th className="w-40 px-3 py-2.5 text-xs font-medium text-text-muted">Status</th>
                <th className="w-24 px-3 py-2.5 text-right text-xs font-medium text-text-muted">
                  Est. Arrival
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted/50">
              {sortedItems.map((item) => {
                const status = (item.stockStatus ?? 'pending') as StockStatus;
                const showETA =
                  item.stockExpectedAt &&
                  (status === 'pending' || status === 'confirmed' || status === 'in_transit_to_cc');

                return (
                  <tr key={item.id} className="hover:bg-surface-secondary/30">
                    <td className="px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium text-text-primary">
                          {item.productName}
                        </span>
                        {item.vintage && (
                          <span className="shrink-0 text-xs text-text-muted">{item.vintage}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center text-sm text-text-primary">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-2.5">
                      {item.source ? (
                        <StockSourceBadge source={item.source} showIcon compact />
                      ) : (
                        <span className="text-xs text-text-muted">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <StockStatusBadge status={status} showIcon />
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-text-muted">
                      {showETA
                        ? item.stockExpectedAt!.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
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
