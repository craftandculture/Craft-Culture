'use client';

import {
  IconBox,
  IconCheck,
  IconClock,
  IconPackage,
  IconPlane,
  IconTruck,
} from '@tabler/icons-react';

import { StockSourceBadge } from './StockStatusBadge';

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

const stockStatusOrder = [
  'pending',
  'confirmed',
  'at_cc_bonded',
  'in_transit_to_cc',
  'at_distributor',
  'delivered',
];

const stockStatusLabels: Record<string, string> = {
  pending: 'Pending Confirmation',
  confirmed: 'Confirmed',
  at_cc_bonded: 'At C&C Bonded',
  in_transit_to_cc: 'In Transit to C&C',
  at_distributor: 'At Distributor',
  delivered: 'Delivered',
};

const stockStatusIcons: Record<string, React.ReactNode> = {
  pending: <IconClock size={16} />,
  confirmed: <IconCheck size={16} />,
  at_cc_bonded: <IconBox size={16} />,
  in_transit_to_cc: <IconPlane size={16} />,
  at_distributor: <IconPackage size={16} />,
  delivered: <IconTruck size={16} />,
};

/**
 * Stock Status Section for order detail pages
 *
 * Displays line items grouped by stock status, showing source type and ETAs.
 * Read-only view for partners and distributors to track stock movement.
 */
const StockStatusSection = ({ items, className }: StockStatusSectionProps) => {
  if (!items || items.length === 0) {
    return null;
  }

  // Group items by stock status
  const groupedItems = items.reduce(
    (acc, item) => {
      const status = item.stockStatus ?? 'pending';
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(item);
      return acc;
    },
    {} as Record<string, LineItem[]>,
  );

  // Calculate summary stats
  const totalItems = items.length;
  const readyItems = items.filter(
    (i) => i.stockStatus === 'at_distributor' || i.stockStatus === 'delivered',
  ).length;
  const pendingItems = items.filter(
    (i) => !i.stockStatus || i.stockStatus === 'pending' || i.stockStatus === 'confirmed',
  ).length;
  const inTransitItems = items.filter(
    (i) => i.stockStatus === 'at_cc_bonded' || i.stockStatus === 'in_transit_to_cc',
  ).length;

  // Find latest ETA for pending/in-transit items
  const pendingETAs = items
    .filter((i) => i.stockExpectedAt && i.stockStatus !== 'at_distributor' && i.stockStatus !== 'delivered')
    .map((i) => i.stockExpectedAt!)
    .sort((a, b) => b.getTime() - a.getTime());
  const latestETA = pendingETAs[0];

  return (
    <div className={className}>
      {/* Summary Header */}
      <div className="mb-4 rounded-lg border border-border-secondary bg-fill-secondary p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-primary">Stock Status</h3>
          {latestETA && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <IconClock size={14} />
              <span>Est. delivery: {latestETA.toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Progress Summary */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-text-primary">{readyItems}</div>
            <div className="text-xs text-text-muted">Ready</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-amber-600">{inTransitItems}</div>
            <div className="text-xs text-text-muted">In Transit</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-text-secondary">{pendingItems}</div>
            <div className="text-xs text-text-muted">Pending</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-fill-tertiary">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${(readyItems / totalItems) * 100}%` }}
          />
        </div>
        <div className="mt-1 text-xs text-text-muted text-right">
          {readyItems} of {totalItems} items ready
        </div>
      </div>

      {/* Grouped Items */}
      <div className="space-y-4">
        {stockStatusOrder.map((status) => {
          const statusItems = groupedItems[status];
          if (!statusItems || statusItems.length === 0) return null;

          return (
            <div key={status} className="rounded-lg border border-border-secondary">
              {/* Status Header */}
              <div className="flex items-center gap-2 border-b border-border-secondary bg-fill-secondary px-4 py-2">
                <span className="text-text-secondary">{stockStatusIcons[status]}</span>
                <span className="text-sm font-medium text-text-primary">
                  {stockStatusLabels[status]}
                </span>
                <span className="text-xs text-text-muted">({statusItems.length})</span>
              </div>

              {/* Items List */}
              <div className="divide-y divide-border-secondary">
                {statusItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium text-text-primary">
                        {item.productName}
                        {item.vintage && <span className="text-text-muted"> {item.vintage}</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-text-muted">{item.quantity} cases</span>
                        {item.source && <StockSourceBadge source={item.source} />}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      {item.stockExpectedAt && status !== 'at_distributor' && status !== 'delivered' && (
                        <div className="text-xs">
                          <div className="text-text-muted">ETA</div>
                          <div className="font-medium text-text-primary">
                            {item.stockExpectedAt.toLocaleDateString()}
                          </div>
                        </div>
                      )}
                      {item.stockConfirmedAt && (
                        <div className="text-xs">
                          <div className="text-text-muted">Confirmed</div>
                          <div className="font-medium text-green-600">
                            {item.stockConfirmedAt.toLocaleDateString()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StockStatusSection;
