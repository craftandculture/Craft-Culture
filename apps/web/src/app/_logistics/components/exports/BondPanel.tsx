'use client';

import { IconAlertTriangle, IconCircleCheckFilled, IconCircleDashed, IconUpload } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import { card, dayLabel, input, label, money, pillClass, secondaryButton, sectionHeading } from './exportUi';
import useExportUpload from './useExportUpload';
import { BOND_CLAIM_MONTHS, BOND_STEP_LABEL, type BondStep } from '../../utils/bondStatus';

export interface BondView {
  goodsValue: number | null;
  bondAmount: number | null;
  currency: string;
  declarationNumber: string | null;
  paidOn: string | null;
  arrivedOn: string | null;
  stampedOn: string | null;
  claimSubmittedOn: string | null;
  refundedOn: string | null;
  refundAmount: number | null;
  step: BondStep;
  deadline: string | null;
  daysLeft: number | null;
  outstanding: boolean;
  overdue: boolean;
  dueSoon: boolean;
}

type StepKey = 'paidOn' | 'arrivedOn' | 'stampedOn' | 'claimSubmittedOn' | 'refundedOn';

const STEPS: { key: StepKey; label: string; hint: string }[] = [
  { key: 'paidOn', label: 'Bond paid', hint: `Starts the ${BOND_CLAIM_MONTHS}-month claim window` },
  { key: 'arrivedOn', label: 'Arrived at destination bond', hint: 'Goods received at the other end' },
  { key: 'stampedOn', label: 'Stamped paperwork received', hint: 'Signed and stamped by customs — upload it here' },
  { key: 'claimSubmittedOn', label: 'Claim submitted', hint: 'Paperwork handed in to redeem the bond' },
  { key: 'refundedOn', label: 'Bond refunded', hint: 'Usually 2–4 weeks after the claim' },
];

/**
 * The movement bond on a bonded transfer
 *
 * C&C's money until it comes back, so the panel leads with how long is left
 * to claim and what the next step is. Each step is a date: ticking it records
 * today, and the date can be corrected. Uploading the stamped paperwork ticks
 * its step too.
 */
const BondPanel = ({ shipmentId, bond, today }: { shipmentId: string; bond: BondView; today: string }) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { send, uploading } = useExportUpload(shipmentId);

  const [goodsValue, setGoodsValue] = useState(bond.goodsValue?.toString() ?? '');
  const [bondAmount, setBondAmount] = useState(bond.bondAmount?.toString() ?? '');
  const [declarationNumber, setDeclarationNumber] = useState(bond.declarationNumber ?? '');
  const [refundAmount, setRefundAmount] = useState(bond.refundAmount?.toString() ?? '');

  const save = useMutation({
    ...api.logistics.admin.exports.saveBond.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: api.logistics.admin.exports.getOne.queryKey({ shipmentId }) });
      void queryClient.invalidateQueries({ queryKey: api.logistics.admin.exports.getMany.queryKey() });
    },
    onError: (error) => toast.error(error.message),
  });

  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  const saveFigures = () => {
    const values = { goodsValue: num(goodsValue), bondAmount: num(bondAmount), refundAmount: num(refundAmount) };
    if (Object.values(values).some((v) => v !== null && (!Number.isFinite(v) || v < 0))) {
      toast.error('Enter amounts as numbers');
      return;
    }
    save.mutate(
      { shipmentId, ...values, declarationNumber: declarationNumber.trim() || null },
      { onSuccess: () => toast.success('Bond saved') },
    );
  };

  const nextStep = STEPS.find((s) => !bond[s.key]);
  const banner = bond.step === 'refunded'
    ? { tone: 'emerald' as const, text: `Refunded ${dayLabel(bond.refundedOn)}${bond.refundAmount != null ? ` · ${money(bond.refundAmount, bond.currency)}` : ''}` }
    : !bond.paidOn
      ? { tone: 'amber' as const, text: 'Record when the bond is paid to start the claim countdown' }
      : bond.step === 'claimed'
        ? { tone: 'blue' as const, text: `Claim submitted ${dayLabel(bond.claimSubmittedOn)} · refund usually within 2–4 weeks` }
        : bond.overdue
          ? { tone: 'red' as const, text: `Claim window closed ${dayLabel(bond.deadline)} — contact customs now` }
          : { tone: bond.dueSoon ? (bond.daysLeft! <= 7 ? ('red' as const) : ('amber' as const)) : ('slate' as const), text: `Claim by ${dayLabel(bond.deadline)} · ${bond.daysLeft} days left` };

  const bannerTone = {
    emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-900',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-900',
    blue: 'bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-900',
    red: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-900',
    slate: 'bg-surface-secondary text-text-primary ring-border-muted',
  }[banner.tone];

  return (
    <section className={`${card} space-y-4 p-5`}>
      <div className="flex items-center justify-between gap-2">
        <p className={sectionHeading}>Movement bond</p>
        <span className={pillClass(bond.step === 'refunded' ? 'emerald' : bond.overdue ? 'red' : 'violet')}>
          {money(bond.bondAmount, bond.currency)} · {BOND_STEP_LABEL[bond.step]}
        </span>
      </div>

      <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ring-1 ring-inset ${bannerTone}`}>
        {banner.tone === 'red' ? <IconAlertTriangle size={16} className="shrink-0" /> : null}
        {banner.text}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="goods-value" className={label}>
            Goods value ({bond.currency})
          </label>
          <input id="goods-value" inputMode="decimal" value={goodsValue} onChange={(e) => setGoodsValue(e.target.value)} className={input} />
        </div>
        <div>
          <label htmlFor="bond-amount" className={label}>
            Bond amount ({bond.currency})
          </label>
          <input
            id="bond-amount"
            inputMode="decimal"
            value={bondAmount}
            onChange={(e) => setBondAmount(e.target.value)}
            placeholder={num(goodsValue) ? `50% = ${(num(goodsValue)! / 2).toFixed(2)}` : '50% of goods value'}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="declaration" className={label}>
            Transfer declaration number
          </label>
          <input id="declaration" value={declarationNumber} onChange={(e) => setDeclarationNumber(e.target.value)} className={input} />
        </div>
        <div>
          <label htmlFor="refund-amount" className={label}>
            Amount refunded ({bond.currency})
          </label>
          <input id="refund-amount" inputMode="decimal" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className={input} />
        </div>
      </div>
      {bond.refundedOn && bond.refundAmount != null && bond.bondAmount != null && bond.refundAmount < bond.bondAmount ? (
        <p className="text-sm font-medium text-red-600">
          Partial refund: {money(bond.bondAmount - bond.refundAmount, bond.currency)} was not returned.
        </p>
      ) : null}
      <div className="flex justify-end">
        <button type="button" onClick={saveFigures} disabled={save.isPending} className={secondaryButton}>
          Save bond details
        </button>
      </div>

      <ol className="space-y-1">
        {STEPS.map((step) => {
          const done = bond[step.key];
          const isNext = nextStep?.key === step.key;
          return (
            <li
              key={step.key}
              className={`flex flex-col gap-2 rounded-lg px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${
                isNext ? 'bg-surface-secondary' : ''
              }`}
            >
              <div className="flex items-start gap-2.5">
                {done ? (
                  <IconCircleCheckFilled size={20} className="mt-px shrink-0 text-emerald-500" />
                ) : (
                  <IconCircleDashed size={20} className="mt-px shrink-0 text-text-muted" />
                )}
                <div>
                  <p className={`text-sm font-medium ${done ? 'text-text-primary' : 'text-text-secondary'}`}>{step.label}</p>
                  <p className="text-xs text-text-muted">{step.hint}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-7 sm:pl-0">
                {step.key === 'stampedOn' ? (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="application/pdf,image/png,image/jpeg"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void send(f, 'stamped');
                        e.target.value = '';
                      }}
                    />
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={secondaryButton}>
                      <IconUpload size={14} /> {uploading ? 'Uploading…' : 'Upload'}
                    </button>
                  </>
                ) : null}
                <input
                  type="date"
                  aria-label={`${step.label} date`}
                  value={done ?? ''}
                  max={today}
                  onChange={(e) => save.mutate({ shipmentId, [step.key]: e.target.value || null })}
                  className={`${input} h-9 w-40`}
                />
                {!done ? (
                  <button
                    type="button"
                    onClick={() => save.mutate({ shipmentId, [step.key]: today })}
                    disabled={save.isPending}
                    className={secondaryButton}
                  >
                    Today
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export default BondPanel;
