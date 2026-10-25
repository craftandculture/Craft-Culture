'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import STOCK_OUT_REASONS from '@/app/_wms/constants/stockOutReasons';
import type { StockOutReason } from '@/app/_wms/constants/stockOutReasons';
import useTRPC from '@/lib/trpc/browser';

export interface ChangeTakeOutReasonProps {
  movementId: string;
  reasonCode: string;
}

/**
 * The reason on a take-out, with a way to correct it
 *
 * Shown on take-out rows in Movements. The bottles stay out; only the reason
 * changes, and with it what the owner reads on their statement.
 */
const ChangeTakeOutReason = ({ movementId, reasonCode }: ChangeTakeOutReasonProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const current = reasonCode.slice('stock_out:'.length) as StockOutReason;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<StockOutReason>(current);
  const [detail, setDetail] = useState('');
  const [price, setPrice] = useState('');
  const [reference, setReference] = useState('');
  const [leftOn, setLeftOn] = useState('');
  const rule = STOCK_OUT_REASONS[reason];

  const change = useMutation(
    api.wms.admin.stock.changeTakeOutReason.mutationOptions({
      onSuccess: async (result) => {
        toast.success(`Reason changed to ${result.label}. The owner now sees: ${result.ownerSees}.`);
        setOpen(false);
        await queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.getMovements.queryKey() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const field = 'border-border-muted bg-background-primary rounded-md border px-2 py-1 text-xs';
  const ready =
    (reason !== current || !!leftOn) &&
    (!rule.needsRecipient || detail.trim() || (reason === current && !!leftOn)) &&
    (!rule.needsPrice || (Number(price) > 0 && reference.trim()));

  if (!open) {
    return (
      <span className="text-text-muted inline-flex items-center gap-2 text-xs">
        {STOCK_OUT_REASONS[current]?.label ?? current}
        <button type="button" onClick={() => setOpen(true)} className="text-text-primary underline underline-offset-2">
          Change reason or date
        </button>
      </span>
    );
  }

  return (
    <form
      className="mt-1 flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        change.mutate({
          movementId,
          reason,
          recipient: detail.trim() || undefined,
          unitPriceUsd: rule.needsPrice ? Number(price) : undefined,
          reference: rule.needsPrice ? reference.trim() : undefined,
          leftOn: leftOn || undefined,
        });
      }}
    >
      <select
        id={`reason-${movementId}`}
        value={reason}
        onChange={(event) => setReason(event.target.value as StockOutReason)}
        className={field}
        aria-label="New reason"
      >
        {(Object.keys(STOCK_OUT_REASONS) as StockOutReason[]).map((key) => (
          <option key={key} value={key}>
            {STOCK_OUT_REASONS[key].label}
          </option>
        ))}
      </select>
      <input
        id={`reason-detail-${movementId}`}
        value={detail}
        onChange={(event) => setDetail(event.target.value)}
        placeholder={`${rule.detailLabel}${rule.needsRecipient ? ' (required)' : ''}`}
        className={`${field} w-48`}
        aria-label={rule.detailLabel}
      />
      {rule.needsPrice && (
        <>
          <input
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="USD per bottle"
            className={`${field} w-28`}
            aria-label="Price per bottle"
          />
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Reference"
            className={`${field} w-28`}
            aria-label="Reference"
          />
        </>
      )}
      <input
        id={`reason-left-on-${movementId}`}
        type="date"
        value={leftOn}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(event) => setLeftOn(event.target.value)}
        className={field}
        aria-label="Date it left"
        title="Date it left, if not the day it was recorded"
      />
      <span className="text-text-muted text-xs">Owner sees: {rule.ownerSees}</span>
      <button
        type="submit"
        disabled={!ready || change.isPending}
        className="bg-text-primary text-background-primary rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-40"
      >
        {change.isPending ? 'Saving…' : 'Save'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-text-muted text-xs underline">
        Cancel
      </button>
    </form>
  );
};

export default ChangeTakeOutReason;
