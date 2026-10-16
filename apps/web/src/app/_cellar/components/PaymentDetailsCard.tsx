'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

const FIELDS = [
  { key: 'accountName', label: 'Account name', placeholder: 'Craft & Culture FZE' },
  { key: 'bankName', label: 'Bank', placeholder: 'Bank name and branch' },
  { key: 'iban', label: 'IBAN', placeholder: 'AE00 0000 0000 0000 0000 000' },
  { key: 'swiftBic', label: 'SWIFT / BIC', placeholder: '' },
  { key: 'accountNumber', label: 'Account number', placeholder: 'If not paying by IBAN' },
  { key: 'currency', label: 'Account currency', placeholder: 'e.g. USD' },
] as const;

type Form = Record<(typeof FIELDS)[number]['key'] | 'note', string>;

const EMPTY: Form = {
  accountName: '',
  bankName: '',
  iban: '',
  swiftBic: '',
  accountNumber: '',
  currency: '',
  note: '',
};

/**
 * Where members pay — the bank details on every reserved purchase
 *
 * Until these are saved, members are told the details will follow by email,
 * so nothing breaks; but every purchase then needs chasing by hand.
 */
const PaymentDetailsCard = () => {
  const api = useTRPC();
  const { data, refetch } = useQuery(api.cellar.admin.getPaymentDetails.queryOptions());
  const [form, setForm] = useState<Form>(EMPTY);

  useEffect(() => {
    if (data?.details) setForm({ ...EMPTY, ...data.details } as Form);
  }, [data]);

  const save = useMutation(
    api.cellar.admin.setPaymentDetails.mutationOptions({
      onSuccess: () => {
        toast.success('Saved — members now see these on every reserved purchase');
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const inputClass =
    'border-border-primary bg-fill-primary text-text-primary min-h-9 w-full rounded-lg border px-2.5 text-sm focus:outline-none';

  return (
    <section className="border-border-muted mb-6 rounded-xl border p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-text-primary text-sm font-semibold">Member payments</h2>
          <p className="text-text-muted text-xs">
            The account members pay into for wine bought in bond. Shown on every reserved purchase, with the purchase
            number as the reference.
          </p>
        </div>
        {!data?.details && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
            Not set — members are told details will follow by email
          </span>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((field) => (
          <label key={field.key} className="flex flex-col gap-1">
            <span className="text-text-muted text-[11px]">{field.label}</span>
            <input
              className={inputClass}
              value={form[field.key]}
              placeholder={field.placeholder}
              onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
          <span className="text-text-muted text-[11px]">Note for members (optional)</span>
          <input
            className={inputClass}
            value={form.note}
            placeholder="e.g. Please cover bank charges so the full amount arrives"
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
          />
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate(form)}
          className="bg-text-primary text-surface-primary h-9 rounded-lg px-4 text-xs font-semibold disabled:opacity-50"
        >
          {save.isPending ? 'Saving…' : 'Save payment details'}
        </button>
      </div>
    </section>
  );
};

export default PaymentDetailsCard;
