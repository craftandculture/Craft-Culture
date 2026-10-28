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

/** The dirham account: the same fields, without a currency (it is AED) */
const AED_FIELDS = FIELDS.filter((field) => field.key !== 'currency');
type AedForm = Record<(typeof AED_FIELDS)[number]['key'], string>;
const EMPTY_AED: AedForm = { accountName: '', bankName: '', iban: '', swiftBic: '', accountNumber: '' };

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
  const [aedForm, setAedForm] = useState<AedForm>(EMPTY_AED);

  useEffect(() => {
    if (data?.details) {
      const { aed, ...usd } = data.details;
      setForm({ ...EMPTY, ...usd } as Form);
      setAedForm({ ...EMPTY_AED, ...(aed ?? {}) } as AedForm);
    }
  }, [data]);

  const save = useMutation(
    api.cellar.admin.setPaymentDetails.mutationOptions({
      onSuccess: () => {
        toast.success('Saved. Members now see these on every reserved purchase');
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
            Where members pay, with the purchase or invoice number as the reference. Payments in dollars show the USD
            account; invoices in dirhams show the AED account. If only one is set, members see that one.
          </p>
        </div>
        {!data?.details && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
            Not set; members are told details will follow by email
          </span>
        )}
      </div>
      <p className="text-text-primary mb-1.5 text-xs font-semibold">USD account</p>
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
      </div>
      <p className="text-text-primary mb-1.5 mt-4 text-xs font-semibold">AED account</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {AED_FIELDS.map((field) => (
          <label key={`aed-${field.key}`} className="flex flex-col gap-1">
            <span className="text-text-muted text-[11px]">{field.label}</span>
            <input
              className={inputClass}
              value={aedForm[field.key]}
              placeholder={field.key === 'accountNumber' ? 'If not paying by IBAN' : field.placeholder}
              onChange={(event) => setAedForm((current) => ({ ...current, [field.key]: event.target.value }))}
            />
          </label>
        ))}
      </div>
      <div className="mt-4 grid gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-[11px]">Note for members, on both accounts (optional)</span>
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
          onClick={() => save.mutate({ ...form, aed: aedForm })}
          className="bg-text-primary text-surface-primary h-9 rounded-lg px-4 text-xs font-semibold disabled:opacity-50"
        >
          {save.isPending ? 'Saving…' : 'Save payment details'}
        </button>
      </div>
    </section>
  );
};

export default PaymentDetailsCard;
