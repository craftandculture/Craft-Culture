'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

export interface ReturnPickToStockProps {
  movementId: string;
  /** Bottles the pick took, to prefill the form */
  pickedBottles: number;
}

/**
 * Record wine coming back from an order, against the pick it left on
 *
 * Shown on pick rows in Movements. Whole cases go back on the case row, loose
 * bottles on the single-bottle row at the same bay. The owner and the partner
 * stock API see a return on the same order, not an unexplained correction.
 */
const ReturnPickToStock = ({ movementId, pickedBottles }: ReturnPickToStockProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bottles, setBottles] = useState(String(pickedBottles));
  const [reason, setReason] = useState('');

  const save = useMutation(
    api.wms.admin.stock.returnPickToStock.mutationOptions({
      onSuccess: async (result) => {
        toast.success(
          `${result.bottles} bottle(s) returned to stock against ${result.pickMovementNumber}` +
            (result.loose > 0 ? ` (${result.loose} as single bottles)` : ''),
        );
        setOpen(false);
        await queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.getMovements.queryKey() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const field = 'border-border-muted bg-background-primary rounded-md border px-2 py-1 text-xs';
  const count = Number(bottles);
  const ready = Number.isInteger(count) && count > 0 && reason.trim().length > 0;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-text-primary text-xs underline underline-offset-2"
      >
        Return to stock
      </button>
    );
  }

  return (
    <form
      className="mt-1 flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        save.mutate({ movementId, bottles: count, reason: reason.trim() });
      }}
    >
      <input
        id={`return-bottles-${movementId}`}
        type="number"
        min={1}
        max={pickedBottles}
        value={bottles}
        onChange={(event) => setBottles(event.target.value)}
        className={`${field} w-16`}
        aria-label="Bottles returned"
      />
      <span className="text-text-muted text-xs">bottle(s)</span>
      <input
        id={`return-reason-${movementId}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Why it came back (required)"
        className={`${field} w-56`}
        aria-label="Why it came back"
      />
      <button
        type="submit"
        disabled={!ready || save.isPending}
        className="bg-text-primary text-background-primary rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-40"
      >
        {save.isPending ? 'Saving…' : 'Return'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-text-muted text-xs underline">
        Cancel
      </button>
    </form>
  );
};

export default ReturnPickToStock;
