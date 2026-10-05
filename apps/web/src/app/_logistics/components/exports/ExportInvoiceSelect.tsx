'use client';

import { useQuery } from '@tanstack/react-query';

import useTRPC from '@/lib/trpc/browser';

import { input, money } from './exportUi';

export interface LinkedInvoice {
  id: string;
  number: string | null;
  consigneeName: string;
  total: number | null;
  currency: string;
}

/**
 * Link an invoice made in the Export Invoices tool
 *
 * Choosing one hands back its number, value and consignee so the job's own
 * fields can be filled from it rather than typed a second time.
 */
const ExportInvoiceSelect = ({
  value,
  onChange,
  id,
}: {
  value: string | null;
  onChange: (invoice: LinkedInvoice | null) => void;
  id?: string;
}) => {
  const api = useTRPC();
  const { data: invoices } = useQuery(api.exportInvoices.admin.getMany.queryOptions());
  const usable = (invoices ?? []).filter((i) => i.status !== 'cancelled');

  return (
    <select
      id={id}
      value={value ?? ''}
      onChange={(e) => {
        const chosen = usable.find((i) => i.id === e.target.value);
        onChange(
          chosen
            ? { id: chosen.id, number: chosen.number, consigneeName: chosen.consigneeName, total: chosen.total, currency: chosen.currency }
            : null,
        );
      }}
      className={input}
    >
      <option value="">Not linked</option>
      {usable.map((i) => (
        <option key={i.id} value={i.id}>
          {i.number ?? 'Draft'} · {i.consigneeName} · {money(i.total, i.currency)}
        </option>
      ))}
    </select>
  );
};

export default ExportInvoiceSelect;
