'use client';

import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogBody from '@/app/_ui/components/Dialog/DialogBody';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogFooter from '@/app/_ui/components/Dialog/DialogFooter';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import useTRPC from '@/lib/trpc/browser';

export interface SplitPackDialogItem {
  id: string;
  productName: string;
  cases: number;
  bottlesPerCase: number | null;
  bottleSizeMl: number | null;
  totalBottles: number | null;
  sourceTotal: number | null;
  sourceUnitPrice: number | null;
}

export interface SplitPackDialogProps {
  /** The line being split; null closes the dialog */
  item: SplitPackDialogItem | null;
  /** What the document billed for the whole wine, across all its lines */
  billedForWine?: number | null;
  /** Bottles on the wine's other lines, which the copy does not touch */
  otherBottles?: number;
  onClose: () => void;
  onSaved: () => void;
}

const PACKS = [1, 2, 3, 4, 6, 12, 24];

/**
 * Add a second pack size to a shipment line
 *
 * Shows the line as two rows — what stays, what is added — and the bottles
 * they make together against what the document billed, so the operator can
 * see "7 × 6 + 1 × 3 = 45" agree before saving rather than after.
 */
const SplitPackDialog = ({ item, billedForWine, otherBottles, onClose, onSaved }: SplitPackDialogProps) => {
  const api = useTRPC();
  const [keepCases, setKeepCases] = useState('');
  const [keepPack, setKeepPack] = useState('');
  const [addCases, setAddCases] = useState('1');
  const [addPack, setAddPack] = useState('');

  useEffect(() => {
    if (!item) return;
    const pack = item.bottlesPerCase ?? 12;
    setKeepCases(String(item.cases));
    setKeepPack(String(pack));
    setAddCases('1');
    setAddPack(String(pack === 3 ? 6 : 3));
  }, [item]);

  const { mutate: split, isPending } = useMutation(
    api.logistics.admin.splitItemPack.mutationOptions({
      onSuccess: () => {
        toast.success('Line duplicated');
        onSaved();
        onClose();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const kc = Number(keepCases);
  const kp = Number(keepPack);
  const ac = Number(addCases);
  const ap = Number(addPack);
  const valid = [kc, kp, ac, ap].every((n) => Number.isInteger(n) && n >= 1);
  const together = valid ? kc * kp + ac * ap : null;
  const billed =
    item?.sourceTotal && item.sourceUnitPrice
      ? Math.round(item.sourceTotal / item.sourceUnitPrice)
      : null;
  const cl = (item?.bottleSizeMl ?? 750) / 10;

  /** Bottles the wine's other lines already hold, outside this dialog */
  const elsewhere = otherBottles ?? 0;
  const afterSave = together != null ? together + elsewhere : null;
  const target = billedForWine ?? billed;
  const diff = afterSave != null && target != null ? afterSave - target : null;

  const input =
    'h-10 w-16 rounded-lg border border-border-muted bg-surface-primary px-2 text-center text-sm tabular-nums focus:border-text-primary focus:outline-none';
  const select =
    'h-10 rounded-lg border border-border-muted bg-surface-primary pl-3 pr-8 text-sm focus:border-text-primary focus:outline-none';

  const row = (
    label: string,
    hint: string,
    cases: string,
    setCases: (v: string) => void,
    pack: string,
    setPack: (v: string) => void,
  ) => {
    const bottles = Number(cases) * Number(pack);

    return (
      <div className="grid grid-cols-[1fr_auto_auto_auto_4.5rem] items-center gap-2 py-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-text-primary">{label}</div>
          <div className="text-xs text-text-muted">{hint}</div>
        </div>
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={cases}
          onChange={(e) => setCases(e.target.value)}
          aria-label={`${label}: cases`}
          className={input}
        />
        <span className="text-sm text-text-muted">×</span>
        <select value={pack} onChange={(e) => setPack(e.target.value)} aria-label={`${label}: pack`} className={select}>
          {[...new Set([...PACKS, Number(pack) || 6])]
            .sort((a, b) => a - b)
            .map((n) => (
              <option key={n} value={n}>
                {n} × {cl}cl
              </option>
            ))}
        </select>
        <span className="text-right text-sm tabular-nums text-text-muted">
          {Number.isFinite(bottles) && bottles > 0 ? `${bottles} btl` : '—'}
        </span>
      </div>
    );
  };

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[34rem] max-w-full">
        <DialogHeader>
          <DialogTitle>Duplicate line</DialogTitle>
          <DialogDescription>{item?.productName}</DialogDescription>
        </DialogHeader>

        <DialogBody className="px-6 py-4">
          <p className="text-xs text-text-muted">
            The copy keeps the wine, LWIN, owner, HS code and price per bottle, and sits directly under this line.
          </p>

          <div className="divide-y divide-border-muted">
            {row('This line', 'Adjust if bottles move across', keepCases, setKeepCases, keepPack, setKeepPack)}
            {row('New line', 'Goes directly underneath', addCases, setAddCases, addPack, setAddPack)}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg bg-fill-secondary/60 px-3 py-2.5">
            <span className="text-sm tabular-nums text-text-primary">
              {afterSave != null ? (
                <>
                  <span className="font-semibold">{afterSave} bottles</span>
                  <span className="text-text-muted">
                    {elsewhere > 0 ? ` for this wine, incl. ${elsewhere} on its other lines` : ' for this wine'}
                  </span>
                </>
              ) : (
                <span className="text-text-muted">Enter whole cases for both lines</span>
              )}
            </span>
            {diff != null && (
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${
                  diff === 0 ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${diff === 0 ? 'bg-green-600' : 'bg-amber-500'}`} />
                {diff === 0
                  ? 'Matches the document'
                  : `Document billed ${target} · ${Math.abs(diff)} ${diff > 0 ? 'too many' : 'short'}`}
              </span>
            )}
          </div>
        </DialogBody>

        <DialogFooter className="px-4 py-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorRole="brand"
            disabled={!valid || isPending || !item}
            onClick={() =>
              item &&
              split({
                itemId: item.id,
                keep: { cases: kc, bottlesPerCase: kp },
                add: { cases: ac, bottlesPerCase: ap },
              })
            }
          >
            {isPending ? 'Saving…' : 'Duplicate line'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SplitPackDialog;
