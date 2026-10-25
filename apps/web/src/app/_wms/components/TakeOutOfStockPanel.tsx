'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import RelabelRemainderPrompt from '@/app/_wms/components/RelabelRemainderPrompt';
import type { RemainderToRelabel } from '@/app/_wms/components/RelabelRemainderPrompt';
import STOCK_OUT_REASONS from '@/app/_wms/constants/stockOutReasons';
import type { StockOutReason } from '@/app/_wms/constants/stockOutReasons';
import planStockOut from '@/app/_wms/utils/planStockOut';
import useTRPC from '@/lib/trpc/browser';

export interface TakeOutOfStockPanelProps {
  productName: string;
  caseConfig: number | null;
  locations: {
    stockId: string;
    locationCode: string;
    ownerName: string;
    quantityCases: number;
    availableCases: number;
    openBottles: number | null;
  }[];
  onClose: () => void;
}

/**
 * Take cases or bottles out of stock with a reason, from a Stock Explorer row
 *
 * The bottles leave with a record of why, so the owner's statement shows them
 * gone (as Sold, Collected by you, or Damaged in our care) rather than missing.
 */
const TakeOutOfStockPanel = ({ productName, caseConfig, locations, onClose }: TakeOutOfStockPanelProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [stockId, setStockId] = useState(locations[0]?.stockId ?? '');
  const [unit, setUnit] = useState<'case' | 'bottle'>('bottle');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<StockOutReason>('marketing');
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [price, setPrice] = useState('');
  const [reference, setReference] = useState('');
  const [backdated, setBackdated] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [remainder, setRemainder] = useState<RemainderToRelabel | null>(null);

  // "all:<owner>": every bay of one owner, never another owner's bottles
  const allOwner = stockId.startsWith('all:') ? stockId.slice(4) : null;
  const ownerLocations = allOwner ? locations.filter((loc) => loc.ownerName === allOwner) : [];
  const ownersWithSeveral = [...new Set(locations.map((loc) => loc.ownerName))].filter(
    (owner) => locations.filter((loc) => loc.ownerName === owner).length > 1,
  );
  const pack = caseConfig ?? 12;
  const rule = STOCK_OUT_REASONS[reason];
  const freeIn = (loc: (typeof locations)[number]) =>
    unit === 'case' ? loc.availableCases : loc.availableCases * pack + (loc.openBottles ?? 0);

  /*
    One bay, or every bay in turn: a wine split across B-04-00 and B-04-01
    could only be taken one bay at a time. "All bays" takes from each in
    order until the quantity is met, one record per bay.
  */
  const steps =
    allOwner
      ? (() => {
          let left = quantity;
          const taken: { stockId: string; quantity: number }[] = [];
          for (const loc of ownerLocations) {
            if (left <= 0) break;
            const take = Math.min(freeIn(loc), left);
            if (take > 0) taken.push({ stockId: loc.stockId, quantity: take });
            left -= take;
          }
          return left > 0 ? null : taken;
        })()
      : [{ stockId, quantity }];

  const row = locations.find((loc) => loc.stockId === stockId);
  const totalFree = ownerLocations.reduce((sum, loc) => sum + freeIn(loc), 0);
  const plan =
    allOwner
      ? steps
        ? {
            ok: true as const,
            bottlesOut: unit === 'case' ? quantity * pack : quantity,
            casesRemoved: 0,
            leftover: 0,
          }
        : { ok: false as const, error: `Only ${totalFree} ${unit === 'case' ? 'case(s)' : 'bottle(s)'} free across all bays.` }
      : row
        ? planStockOut(
            { quantityCases: row.quantityCases, availableCases: row.availableCases, openBottles: row.openBottles ?? 0, pack },
            unit,
            quantity,
          )
        : { ok: false as const, error: 'Choose a bay.' };
  const ownerName = allOwner ?? row?.ownerName;
  const missing =
    (rule.needsRecipient && !recipient.trim() ? `Fill in "${rule.detailLabel}". ` : '') +
    (rule.needsPrice && (!(Number(price) > 0) || !reference.trim()) ? 'Add the price per bottle and a reference.' : '');

  const takeOut = useMutation(
    api.wms.admin.stock.takeOut.mutationOptions({
      // Success is reported once by submit, after every bay is done
      onError: (error) => {
        toast.error(error.message);
        setConfirming(false);
      },
    }),
  );

  const submit = async () => {
    if (!steps) return;
    let lastResult: Awaited<ReturnType<typeof takeOut.mutateAsync>> | null = null;
    let bottlesOut = 0;
    for (const step of steps) {
      // One record per bay; a failure stops the rest (onError reports it)
      const result = await takeOut
        .mutateAsync({
        stockId: step.stockId,
        unit,
        quantity: step.quantity,
        reason,
        recipient: recipient.trim() || undefined,
        note: note.trim() || undefined,
        unitPriceUsd: rule.needsPrice ? Number(price) : undefined,
        reference: rule.needsPrice ? reference.trim() : undefined,
        backdated,
      })
        .catch(() => null);
      if (!result) return;
      lastResult = result;
      bottlesOut += result.bottles;
    }
    if (!lastResult) return;
    toast.success(`${bottlesOut} bottle(s) taken out of ${lastResult.ownerName}'s stock. They see: ${lastResult.ownerSees}.`);
    await queryClient.invalidateQueries();
    if (lastResult.remainder) {
      setRemainder({ ...lastResult.remainder, bottles: Number(lastResult.remainder.bottles) });
      return;
    }
    onClose();
  };


  const field = 'border-border-muted bg-background-primary rounded-md border px-2 py-1.5 text-sm';

  if (remainder) {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <RelabelRemainderPrompt remainder={remainder} onDone={onClose} />
      </div>
    );
  }

  return (
    <div className="border-border-muted space-y-3 rounded-lg border bg-amber-50/60 p-3 dark:bg-amber-900/10" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Take out of stock · {productName}</p>
        <button type="button" onClick={onClose} className="text-text-muted text-xs underline">
          Cancel
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-medium">
          From
          <select value={stockId} onChange={(e) => setStockId(e.target.value)} className={field}>
            {locations.map((loc) => (
              <option key={loc.stockId} value={loc.stockId}>
                {loc.locationCode} · {loc.ownerName} · {loc.availableCases} free of {loc.quantityCases}
                {loc.openBottles ? ` +${loc.openBottles} loose` : ''}
              </option>
            ))}
            {ownersWithSeveral.map((owner) => (
              <option key={`all:${owner}`} value={`all:${owner}`}>
                All bays · {owner} ·{' '}
                {locations
                  .filter((loc) => loc.ownerName === owner)
                  .reduce((sum, loc) => sum + loc.availableCases * pack + (loc.openBottles ?? 0), 0)}{' '}
                bottles free
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-xs font-medium">
          How many
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className={`${field} w-20`}
              aria-label="Quantity"
            />
            <select value={unit} onChange={(e) => setUnit(e.target.value as 'case' | 'bottle')} className={field} aria-label="Unit">
              <option value="bottle">bottles</option>
              <option value="case">cases of {pack}</option>
            </select>
          </div>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Reason
          <select value={reason} onChange={(e) => setReason(e.target.value as StockOutReason)} className={field}>
            {(Object.keys(STOCK_OUT_REASONS) as StockOutReason[]).map((key) => (
              <option key={key} value={key}>
                {STOCK_OUT_REASONS[key].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          {rule.needsRecipient ? `${rule.detailLabel} (required)` : rule.detailLabel}
          <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder={rule.detailHint} className={field} />
        </label>
        {rule.needsPrice && (
          <>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Price per bottle (USD)
              <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Reference
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Receipt or invoice no." className={field} />
            </label>
          </>
        )}
        <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2">
          Note (staff only)
          <input value={note} onChange={(e) => setNote(e.target.value)} className={field} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={backdated} onChange={(e) => setBackdated(e.target.checked)} />
        These bottles already left earlier and are only being recorded now
      </label>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        {plan.ok ? (
          <span>
            {plan.bottlesOut} bottle(s) leave {ownerName}&apos;s stock
            {allOwner && steps ? ` from ${steps.length} bays` : ''}
            {plan.casesRemoved > 0 && unit === 'bottle' && pack > 1 ? `, opening ${plan.casesRemoved} case(s)` : ''}
            {plan.ok && plan.leftover > 0 ? `; ${plan.leftover} go back as singles` : ''}. The owner sees: <strong>{rule.ownerSees}</strong>.
          </span>
        ) : (
          <span className="text-red-700">{plan.error}</span>
        )}
        {missing && <span className="text-red-700">{missing}</span>}
      </div>

      <div className="flex gap-2">
        {!confirming ? (
          <button
            type="button"
            disabled={!plan.ok || Boolean(missing)}
            onClick={() => setConfirming(true)}
            className="bg-text-primary text-background-primary rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40"
          >
            Take out
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={takeOut.isPending}
              onClick={submit}
              className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {takeOut.isPending ? 'Recording…' : `Confirm: take out ${plan.ok ? plan.bottlesOut : 0} bottle(s)`}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-text-muted px-2 text-sm underline">
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default TakeOutOfStockPanel;
