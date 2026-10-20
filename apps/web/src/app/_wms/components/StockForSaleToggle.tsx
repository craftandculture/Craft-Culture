'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

export interface StockForSaleToggleProps {
  stockId: string;
  notForSale: boolean;
}

/**
 * Held pill for a stock line, with a one-click way to put it on sale
 *
 * A held line never reaches a price list or an order, and nothing on the line
 * said so, which is why releasing a wine could look as if it did nothing. Lines
 * already on sale show nothing, keeping the owner cell quiet for most stock.
 */
const StockForSaleToggle = ({ stockId, notForSale }: StockForSaleToggleProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    ...api.wms.admin.ownership.setForSale.mutationOptions(),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.stock.getByProduct.queryKey(),
      });
      toast.success(result.message);
    },
    onError: (error) => {
      toast.error(error.message || 'Could not change this line');
    },
  });

  if (!notForSale) return null;

  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <span
        className="rounded bg-amber-100 px-1.5 py-px text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
        title="Held for its owner: not on price lists or orders"
      >
        Held
      </span>
      <button
        type="button"
        disabled={isPending}
        onClick={(e) => {
          e.stopPropagation();
          mutate({ stockId, forSale: true });
        }}
        className="text-text-muted hover:text-text-primary rounded px-1 text-[11px] font-medium underline-offset-2 hover:underline disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Put on sale'}
      </button>
    </span>
  );
};

export default StockForSaleToggle;
