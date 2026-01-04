'use client';

import { IconAlertCircle, IconBox, IconCheck, IconLoader2, IconPlane } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { PrivateClientOrder, PrivateClientOrderItem } from '@/database/schema';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

import StockSourceSelect from './StockSourceSelect';

type StockSource = 'cc_inventory' | 'partner_airfreight' | 'partner_local' | 'manual';

interface LineItemStock {
  itemId: string;
  source: StockSource;
  stockExpectedAt?: Date;
}

interface StockIdentificationSectionProps {
  order: PrivateClientOrder & {
    items?: PrivateClientOrderItem[];
  };
  onApproved?: () => void;
}

/**
 * Stock identification section for order approval
 *
 * Shows during the review phase to allow admin to identify
 * which items are from local stock vs need to be sourced.
 */
const StockIdentificationSection = ({ order, onApproved }: StockIdentificationSectionProps) => {
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  // Track stock source and ETA for each item
  const [lineItemStocks, setLineItemStocks] = useState<Map<string, LineItemStock>>(() => {
    const map = new Map<string, LineItemStock>();
    order.items?.forEach((item) => {
      map.set(item.id, {
        itemId: item.id,
        source: (item.source as StockSource) || 'manual',
        stockExpectedAt: item.stockExpectedAt ?? undefined,
      });
    });
    return map;
  });

  // Check local stock availability for products
  const productIds = order.items?.map((item) => item.productId).filter(Boolean) as string[];
  const { data: stockAvailability } = useQuery({
    ...api.privateClientOrders.checkLocalStock.queryOptions({ productIds }),
    enabled: productIds.length > 0,
  });

  // Approve mutation
  const { mutate: approveOrder, isPending: isApproving } = useMutation({
    mutationFn: () =>
      trpcClient.privateClientOrders.adminApprove.mutate({
        orderId: order.id,
        lineItems: Array.from(lineItemStocks.values()),
      }),
    onSuccess: () => {
      toast.success('Order approved with stock identification');
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
      onApproved?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to approve order');
    },
  });

  const updateItemStock = (itemId: string, updates: Partial<LineItemStock>) => {
    setLineItemStocks((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(itemId);
      if (existing) {
        newMap.set(itemId, { ...existing, ...updates });
      }
      return newMap;
    });
  };

  // Calculate summary
  const items = order.items ?? [];
  const localItems = items.filter((item) => lineItemStocks.get(item.id)?.source === 'cc_inventory');
  const sourcedItems = items.filter((item) => {
    const source = lineItemStocks.get(item.id)?.source;
    return source === 'partner_airfreight' || source === 'partner_local';
  });

  // Check if all items have source set
  const allItemsHaveSource = items.every((item) => {
    const stock = lineItemStocks.get(item.id);
    return stock?.source && stock.source !== 'manual';
  });

  // Check if sourced items have ETA
  const sourcedItemsMissingEta = sourcedItems.filter((item) => {
    const stock = lineItemStocks.get(item.id);
    return !stock?.stockExpectedAt;
  });

  const canApprove = allItemsHaveSource && sourcedItemsMissingEta.length === 0;

  // Calculate latest ETA
  const latestEta = sourcedItems.reduce<Date | null>((latest, item) => {
    const eta = lineItemStocks.get(item.id)?.stockExpectedAt;
    if (!eta) return latest;
    if (!latest || eta > latest) return eta;
    return latest;
  }, null);

  // Only show for orders under review
  if (!['submitted', 'under_cc_review'].includes(order.status)) {
    return null;
  }

  return (
    <Card className="border-2 border-fill-brand/30 bg-fill-brand/5">
      <CardContent className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fill-brand/20">
              <Icon icon={IconBox} size="sm" className="text-fill-brand" />
            </div>
            <div>
              <Typography variant="headingSm">Stock Identification</Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Identify stock source for each item before approval
              </Typography>
            </div>
          </div>

          {/* Summary badges */}
          <div className="flex items-center gap-2">
            {localItems.length > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-fill-success/10 px-2 py-1 text-xs text-text-success">
                <Icon icon={IconBox} size="xs" />
                {localItems.length} local
              </span>
            )}
            {sourcedItems.length > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-fill-warning/10 px-2 py-1 text-xs text-text-warning">
                <Icon icon={IconPlane} size="xs" />
                {sourcedItems.length} sourced
              </span>
            )}
          </div>
        </div>

        {/* Line items table */}
        <div className="mb-4 overflow-x-auto rounded-lg border border-border-muted">
          <table className="w-full text-xs">
            <thead className="border-b border-border-muted bg-surface-secondary/50">
              <tr>
                <th className="px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  Product
                </th>
                <th className="w-12 px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  Qty
                </th>
                <th className="w-16 px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  Stock
                </th>
                <th className="w-[110px] px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  Source
                </th>
                <th className="w-[90px] px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  ETA
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted/50">
              {items.map((item) => {
                const stock = lineItemStocks.get(item.id);
                const availability = item.productId ? stockAvailability?.get(item.productId) : null;
                const isLocal = stock?.source === 'cc_inventory';
                const needsEta = stock?.source === 'partner_airfreight' || stock?.source === 'partner_local';

                return (
                  <tr key={item.id} className="hover:bg-surface-muted/20">
                    <td className="px-2 py-1.5">
                      <div className="flex items-baseline gap-1">
                        <span className="font-medium">{item.productName}</span>
                        {item.vintage && (
                          <span className="text-text-muted">{item.vintage}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-center font-medium">{item.quantity}</td>
                    <td className="px-2 py-1.5">
                      {availability ? (
                        <span className={`text-xs ${availability.availableQuantity >= item.quantity ? 'text-text-success' : 'text-text-warning'}`}>
                          {availability.availableQuantity}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">-</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <StockSourceSelect
                        value={stock?.source}
                        onChange={(source) => updateItemStock(item.id, { source })}
                        className="h-7 w-full text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      {needsEta ? (
                        <Input
                          type="date"
                          value={stock?.stockExpectedAt ? format(stock.stockExpectedAt, 'yyyy-MM-dd') : ''}
                          onChange={(e) => {
                            const date = e.target.value ? new Date(e.target.value) : undefined;
                            updateItemStock(item.id, { stockExpectedAt: date });
                          }}
                          className="h-7 w-full text-xs"
                        />
                      ) : isLocal ? (
                        <span className="inline-flex items-center gap-1 text-xs text-text-success">
                          <Icon icon={IconCheck} size="xs" />
                          Ready
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Validation warnings */}
        {!allItemsHaveSource && (
          <div className="mb-3 flex items-center gap-2 rounded-md bg-fill-warning/10 px-3 py-2 text-xs text-text-warning">
            <Icon icon={IconAlertCircle} size="xs" />
            Please select a source for all items
          </div>
        )}
        {sourcedItemsMissingEta.length > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-md bg-fill-warning/10 px-3 py-2 text-xs text-text-warning">
            <Icon icon={IconAlertCircle} size="xs" />
            {sourcedItemsMissingEta.length} sourced item(s) need ETA dates
          </div>
        )}

        {/* Footer with ETA summary and approve button */}
        <div className="flex items-center justify-between border-t border-border-muted pt-3">
          <div>
            {latestEta && (
              <Typography variant="bodySm" colorRole="muted">
                Estimated delivery: <span className="font-medium text-text-primary">{format(latestEta, 'MMM d, yyyy')}</span>
              </Typography>
            )}
            {!latestEta && localItems.length === items.length && (
              <Typography variant="bodySm" className="text-text-success">
                All items in stock - ready for immediate dispatch
              </Typography>
            )}
          </div>

          <Button
            onClick={() => approveOrder()}
            disabled={!canApprove || isApproving}
            colorRole="brand"
          >
            {isApproving ? (
              <>
                <Icon icon={IconLoader2} size="sm" className="animate-spin" />
                <span className="ml-2">Approving...</span>
              </>
            ) : (
              <>
                <Icon icon={IconCheck} size="sm" />
                <span className="ml-2">Approve Order</span>
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default StockIdentificationSection;
