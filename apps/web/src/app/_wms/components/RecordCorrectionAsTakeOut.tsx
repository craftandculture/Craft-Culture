'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import STOCK_OUT_REASONS from '@/app/_wms/constants/stockOutReasons';
import type { StockOutReason } from '@/app/_wms/constants/stockOutReasons';
import useTRPC from '@/lib/trpc/browser';

export interface RecordCorrectionAsTakeOutProps {
  movementId: string;
}

/**
 * Turn a pack fix or count correction that removed bottles into the take-out it was
 *
 * Shown on those rows in Movements. Stock is not changed again; the record
 * gains its reason, who it went to and the day it left, so the owner's
 * timeline shows what happened instead of "stock corrected".
 */
const RecordCorrectionAsTakeOut = ({ movementId }: RecordCorrectionAsTakeOutProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<StockOutReason>('collected_by_owner');
  const [detail, setDetail] = useState('');
  const [leftOn, setLeftOn] = useState('');
  const rule = STOCK_OUT_REASONS[reason];

  const record = useMutation(
    api.wms.admin.stock.recordCorrectionAsTakeOut.mutationOptions({
      onSuccess: async (result) => {
        toast.success(`${result.bottles} bottle(s) recorded as ${result.label}. The owner sees: ${result.ownerSees}.`);
        setOpen(false);
        await queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.getMovements.queryKey() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const field = 'border-border-muted bg-background-primary rounded-md border px-2 py-1 text-xs';
  const ready = !!leftOn && (!rule.needsRecipient || detail.trim());

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-text-primary text-xs underline underline-offset-2"
      >
        Record as take-out
      </button>
    );
  }

  return (
    <form
      className="mt-1 flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        record.mutate({ movementId, reason, recipient: detail.trim() || undefined, leftOn });
      }}
    >
      <select
        id={`correction-reason-${movementId}`}
        value={reason}
        onChange={(event) => setReason(event.target.value as StockOutReason)}
        className={field}
        aria-label="Reason"
      >
        {(Object.keys(STOCK_OUT_REASONS) as StockOutReason[])
          .filter((key) => !STOCK_OUT_REASONS[key].needsPrice)
          .map((key) => (
            <option key={key} value={key}>
              {STOCK_OUT_REASONS[key].label}
            </option>
          ))}
      </select>
      <input
        id={`correction-detail-${movementId}`}
        value={detail}
        onChange={(event) => setDetail(event.target.value)}
        placeholder={`${rule.detailLabel}${rule.needsRecipient ? ' (required)' : ''}`}
        className={`${field} w-48`}
        aria-label={rule.detailLabel}
      />
      <input
        id={`correction-left-on-${movementId}`}
        type="date"
        value={leftOn}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(event) => setLeftOn(event.target.value)}
        className={field}
        aria-label="Date it left"
      />
      <span className="text-text-muted text-xs">Stock is not changed again. Owner sees: {rule.ownerSees}</span>
      <button
        type="submit"
        disabled={!ready || record.isPending}
        className="bg-text-primary text-background-primary rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-40"
      >
        {record.isPending ? 'Saving…' : 'Save'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-text-muted text-xs underline">
        Cancel
      </button>
    </form>
  );
};

export default RecordCorrectionAsTakeOut;
