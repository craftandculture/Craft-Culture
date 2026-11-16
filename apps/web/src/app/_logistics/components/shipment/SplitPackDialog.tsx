'use client';

import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
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
const SplitPackDialog = ({ item, onClose, onSaved }: SplitPackDialogProps) => {
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
        toast.success('Pack size added');
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

  const field = 'h-9 w-20 rounded-lg border border-border-muted bg-surface-primary px-2 text-right text-sm tabular-nums';

  const row = (
    label: string,
    cases: string,
    setCases: (v: string) => void,
    pack: string,
    setPack: (v: string) => void,
  ) => (
    <div className="flex items-center gap-2">
      <span className="w-28 text-xs text-text-muted">{label}</span>
      <input
        type="number"
        min={1}
        value={cases}
        onChange={(e) => setCases(e.target.value)}
        aria-label={`${label} cases`}
        className={field}
      />
      <span className="text-sm text-text-muted">cases of</span>
      <select
        value={pack}
        onChange={(e) => setPack(e.target.value)}
        aria-label={`${label} pack`}
        className="h-9 rounded-lg border border-border-muted bg-surface-primary px-2 text-sm"
      >
        {[...new Set([...PACKS, Number(pack) || 6])].sort((a, b) => a - b).map((n) => (
          <option key={n} value={n}>
            {n} × {cl}cl
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add another pack size</DialogTitle>
          <DialogDescription>
            {item?.productName}. The new line goes directly under this one, with the same wine, owner, HS
            code and price per bottle.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-3">
          {row('This line', keepCases, setKeepCases, keepPack, setKeepPack)}
          {row('New line', addCases, setAddCases, addPack, setAddPack)}

          <div className="mt-1 rounded-lg bg-fill-secondary/60 px-3 py-2 text-sm">
            {together != null ? (
              <>
                <span className="font-semibold tabular-nums">
                  {kc} × {kp} + {ac} × {ap} = {together} bottles
                </span>
                {billed != null && (
                  <span className={billed === together ? 'ml-2 text-green-700' : 'ml-2 text-text-warning'}>
                    {billed === together ? '· matches the document' : `· document billed ${billed}`}
                  </span>
                )}
              </>
            ) : (
              <span className="text-text-muted">Enter whole cases and a pack for both lines.</span>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
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
            {isPending ? 'Saving…' : 'Add pack size'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SplitPackDialog;
