'use client';

import { IconCheck, IconPackage, IconTruck } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Checkbox from '@/app/_ui/components/Checkbox/Checkbox';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import { useTRPCClient } from '@/lib/trpc/browser';

interface LineItem {
  id: string;
  productName: string;
  vintage: number | string | null;
  quantity: number;
  stockStatus: string | null;
}

export interface StockReceiptConfirmationProps {
  orderId: string;
  items: LineItem[];
  onConfirmed?: () => void;
}

/**
 * Stock Receipt Confirmation component for distributors
 *
 * Shows items that are in transit to the distributor and allows
 * them to confirm receipt of stock at their warehouse.
 */
const StockReceiptConfirmation = ({
  orderId,
  items,
  onConfirmed,
}: StockReceiptConfirmationProps) => {
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Filter items that are in transit to distributor or at C&C (ready for transit)
  const pendingItems = items.filter(
    (item) =>
      item.stockStatus === 'in_transit_to_distributor' ||
      item.stockStatus === 'at_cc_bonded',
  );

  const { mutate: confirmReceipt, isPending } = useMutation({
    mutationFn: (itemIds: string[]) =>
      trpcClient.privateClientOrders.distributorConfirmStockReceipt.mutate({
        orderId,
        itemIds,
      }),
    onSuccess: (result) => {
      toast.success(`${result.updatedCount} items marked as received`);
      setSelectedItems(new Set());
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
      onConfirmed?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to confirm stock receipt');
    },
  });

  const handleSelectAll = () => {
    if (selectedItems.size === pendingItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(pendingItems.map((i) => i.id)));
    }
  };

  const handleSelectItem = (itemId: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setSelectedItems(newSet);
  };

  const handleConfirm = () => {
    const itemIds = Array.from(selectedItems);
    if (itemIds.length === 0) {
      toast.error('Please select items to confirm receipt');
      return;
    }
    confirmReceipt(itemIds);
  };

  // Don't render if no pending items
  if (pendingItems.length === 0) {
    return null;
  }

  const inTransitCount = pendingItems.filter(
    (i) => i.stockStatus === 'in_transit_to_distributor',
  ).length;

  return (
    <Card className="border-2 border-fill-warning/50 bg-fill-warning/5">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-fill-warning/20">
              <Icon icon={IconTruck} size="lg" className="text-fill-warning" />
            </div>
            <div className="flex-1">
              <Typography variant="headingSm" className="mb-1">
                Stock Arriving - Confirm Receipt
              </Typography>
              <Typography variant="bodySm" colorRole="muted">
                {inTransitCount > 0
                  ? `${inTransitCount} item(s) are in transit to your warehouse. Select items and confirm when you receive them.`
                  : `${pendingItems.length} item(s) at C&C ready for collection. Confirm when received.`}
              </Typography>
            </div>
          </div>

          {/* Item Selection */}
          <div className="ml-0 sm:ml-16">
            <div className="rounded-lg border border-border-muted bg-surface-secondary/50">
              {/* Select All Header */}
              <div className="flex items-center gap-3 border-b border-border-muted px-4 py-2.5">
                <Checkbox
                  id="select-all"
                  checked={selectedItems.size === pendingItems.length && pendingItems.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <label htmlFor="select-all" className="text-xs font-medium text-text-muted cursor-pointer">
                  Select All ({pendingItems.length} items)
                </label>
              </div>

              {/* Item List */}
              <div className="divide-y divide-border-muted/50">
                {pendingItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/20"
                  >
                    <Checkbox
                      id={`item-${item.id}`}
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={() => handleSelectItem(item.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <label
                        htmlFor={`item-${item.id}`}
                        className="block text-sm font-medium text-text-primary cursor-pointer truncate"
                      >
                        {item.productName}
                        {item.vintage && (
                          <span className="ml-1 text-text-muted">{item.vintage}</span>
                        )}
                      </label>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span>{item.quantity} cases</span>
                        <span className="text-text-muted/50">|</span>
                        <span
                          className={
                            item.stockStatus === 'in_transit_to_distributor'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-purple-600 dark:text-purple-400'
                          }
                        >
                          {item.stockStatus === 'in_transit_to_distributor'
                            ? 'In Transit'
                            : 'At C&C'}
                        </span>
                      </div>
                    </div>
                    <Icon
                      icon={IconPackage}
                      size="sm"
                      className={
                        item.stockStatus === 'in_transit_to_distributor'
                          ? 'text-amber-500'
                          : 'text-purple-500'
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Confirm Button */}
            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleConfirm}
                disabled={selectedItems.size === 0 || isPending}
                colorRole="brand"
              >
                <ButtonContent iconLeft={IconCheck} isLoading={isPending}>
                  Confirm Receipt ({selectedItems.size} items)
                </ButtonContent>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StockReceiptConfirmation;
