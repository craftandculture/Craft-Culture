'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import { LCB_RECHARGE_MARKUP } from '../../utils/ukMoveTotal';
import { toMemberPrice } from '../../utils/ukRateCharge';

const FIELDS = [
  { key: 'storagePerUnitMonthGbp', label: 'Storage', unit: 'per case unit per month' },
  { key: 'receivePerCaseGbp', label: 'Receiving', unit: 'per case in' },
  { key: 'handlingOutPerCaseGbp', label: 'Handling out', unit: 'per case out' },
  { key: 'exportDocsPerMoveGbp', label: 'Export paperwork', unit: 'per consignment' },
] as const;

type Key = (typeof FIELDS)[number]['key'];

const gbp = (value: number) => `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The UK rate card: LCB's prices at cost, by the date they took effect
 *
 * Wine at our UK bond is charged under these rates while it is there; wine in
 * the UAE under the membership. Members pay cost plus the recharge. A rise
 * from LCB is entered as a new version from the day it applies, and the old
 * figures stay for the months they covered.
 */
const UkRatesCard = () => {
  const api = useTRPC();
  const { data, refetch } = useQuery(api.cellar.admin.getUkRates.queryOptions());
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<Record<Key, string> & { effectiveFrom: string; notes: string }>({
    effectiveFrom: format(new Date(), 'yyyy-MM-dd'),
    storagePerUnitMonthGbp: '',
    receivePerCaseGbp: '',
    handlingOutPerCaseGbp: '',
    exportDocsPerMoveGbp: '',
    notes: '',
  });

  const add = useMutation(
    api.cellar.admin.addUkRates.mutationOptions({
      onSuccess: () => {
        toast.success('UK rates saved');
        setIsAdding(false);
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const remove = useMutation(
    api.cellar.admin.removeUkRates.mutationOptions({
      onSuccess: () => {
        toast.success('That version is removed');
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const current = data?.current ?? null;
  const markup = Math.round(LCB_RECHARGE_MARKUP * 100);

  const startAdding = () => {
    setForm({
      effectiveFrom: format(new Date(), 'yyyy-MM-dd'),
      storagePerUnitMonthGbp: current ? String(current.storagePerUnitMonthGbp) : '',
      receivePerCaseGbp: current ? String(current.receivePerCaseGbp) : '',
      handlingOutPerCaseGbp: current ? String(current.handlingOutPerCaseGbp) : '',
      exportDocsPerMoveGbp: current ? String(current.exportDocsPerMoveGbp) : '',
      notes: '',
    });
    setIsAdding(true);
  };

  return (
    <section className="border-border-muted bg-surface-primary rounded-xl border p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-text-primary text-base font-semibold">UK rates · London City Bond, Burton</h2>
          <p className="text-text-muted mt-0.5 max-w-2xl text-sm">
            Wine at our UK bond is charged under these rates while it is held there; wine in the UAE under the
            membership. Enter what LCB charges us, from their tariff or invoice, not the member price: the {markup}%
            is added for you. Storage has no allowance.
          </p>
        </div>
        {!isAdding && (
          <button
            type="button"
            onClick={startAdding}
            className="bg-text-primary text-surface-primary h-9 rounded-lg px-3 text-xs font-semibold"
          >
            {current ? 'New prices from LCB' : 'Enter LCB’s prices'}
          </button>
        )}
      </div>

      {current ? (
        <div className="border-border-muted mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-fill-muted/60 border-border-muted border-b">
              <tr className="text-text-muted text-[10px] uppercase tracking-[0.08em]">
                <th className="px-3 py-2 text-left">Charge</th>
                <th className="px-3 py-2 text-right">LCB charges us</th>
                <th className="px-3 py-2 text-right">Member pays (+ {markup}%)</th>
              </tr>
            </thead>
            <tbody className="divide-border-muted divide-y">
              {FIELDS.map((field) => (
                <tr key={field.key}>
                  <td className="px-3 py-2">
                    <span className="text-text-primary font-medium">{field.label}</span>
                    <span className="text-text-muted ml-1.5 text-xs">{field.unit}</span>
                  </td>
                  <td className="text-text-muted px-3 py-2 text-right tabular-nums">{gbp(current[field.key])}</td>
                  <td className="text-text-primary px-3 py-2 text-right font-semibold tabular-nums">
                    {gbp(toMemberPrice(current[field.key]))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-text-muted border-border-muted flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs">
            <span>
              In force since {format(new Date(current.effectiveFrom), 'd MMMM yyyy')}
              {current.notes ? ` · ${current.notes}` : ''}
            </span>
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ id: current.id })}
              className="hover:text-red-700 disabled:opacity-50"
            >
              Remove this version (entered in error)
            </button>
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-200">
          No UK prices yet. Enter LCB&rsquo;s storage and handling charges from their tariff or a recent invoice, and
          UK storage appears on the Storage tab.
        </p>
      )}

      {isAdding && (
        <form
          className="border-border-muted mt-4 space-y-3 rounded-lg border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate({
              effectiveFrom: form.effectiveFrom,
              storagePerUnitMonthGbp: Number(form.storagePerUnitMonthGbp) || 0,
              receivePerCaseGbp: Number(form.receivePerCaseGbp) || 0,
              handlingOutPerCaseGbp: Number(form.handlingOutPerCaseGbp) || 0,
              exportDocsPerMoveGbp: Number(form.exportDocsPerMoveGbp) || 0,
              notes: form.notes.trim() || undefined,
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">
                Applies from
              </span>
              <input
                type="date"
                value={form.effectiveFrom}
                onChange={(event) => setForm((current) => ({ ...current, effectiveFrom: event.target.value }))}
                className="border-border-muted bg-surface-primary h-9 w-full rounded-lg border px-2.5 text-sm"
              />
            </label>
            {FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">
                  {field.label}: what LCB charges us, £ {field.unit}
                </span>
                <input
                  inputMode="decimal"
                  value={form[field.key]}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, [field.key]: event.target.value.replace(/[^\d.]/g, '') }))
                  }
                  className="border-border-muted bg-surface-primary h-9 w-full rounded-lg border px-2.5 text-sm tabular-nums"
                />
              </label>
            ))}
            <label className="block sm:col-span-2 lg:col-span-3">
              <span className="text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">
                Note (optional)
              </span>
              <input
                value={form.notes}
                placeholder="e.g. LCB tariff 2026–27"
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="border-border-muted bg-surface-primary h-9 w-full rounded-lg border px-2.5 text-sm"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={add.isPending}
              className="bg-text-primary text-surface-primary h-9 rounded-lg px-3 text-xs font-semibold disabled:opacity-50"
            >
              {add.isPending ? 'Saving…' : 'Save these prices'}
            </button>
            <button type="button" onClick={() => setIsAdding(false)} className="text-text-muted text-xs hover:underline">
              Cancel
            </button>
          </div>
        </form>
      )}

      {(data?.history.length ?? 0) > 1 && (
        <details className="mt-3">
          <summary className="text-text-muted cursor-pointer text-xs">Earlier prices</summary>
          <ul className="text-text-muted mt-2 space-y-1 text-xs">
            {data!.history
              .filter((row) => row.id !== current?.id)
              .map((row) => (
                <li key={row.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span>
                    From {format(new Date(row.effectiveFrom), 'd MMM yyyy')}: storage {gbp(row.storagePerUnitMonthGbp)},
                    receiving {gbp(row.receivePerCaseGbp)}, handling out {gbp(row.handlingOutPerCaseGbp)}, export
                    paperwork {gbp(row.exportDocsPerMoveGbp)}
                    {row.notes ? ` · ${row.notes}` : ''}
                  </span>
                  <button
                    type="button"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate({ id: row.id })}
                    className="hover:text-red-700 underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
          </ul>
        </details>
      )}
    </section>
  );
};

export default UkRatesCard;
