'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import useTRPC from '@/lib/trpc/browser';

import { dayLabel, input, money } from './exportUi';

export interface ZohoInvoiceChoice {
  invoiceNumber: string;
  customerName: string;
  zohoCustomerId: string;
  total: number;
  currency: string;
}

/**
 * The invoice number, with Zoho invoices suggested as it is typed
 *
 * Picking a suggestion hands back the invoice's number, total, currency and
 * customer so the job is filled from Zoho. The number stays a plain field, so
 * it can still be typed or corrected by hand at any time.
 */
const ZohoInvoiceInput = ({
  id,
  value,
  onChange,
  onPick,
  zohoCustomerId,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onPick: (invoice: ZohoInvoiceChoice) => void;
  zohoCustomerId: string | null;
}) => {
  const api = useTRPC();
  const [open, setOpen] = useState(false);
  const search = value.trim();
  const { data: invoices } = useQuery({
    ...api.logistics.admin.exports.searchZohoInvoices.queryOptions({ search: search || undefined, zohoCustomerId }),
    enabled: open,
  });

  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search Zoho or type"
        className={input}
        autoComplete="off"
      />
      {open && invoices && invoices.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-[min(28rem,80vw)] overflow-y-auto rounded-lg border border-border-muted bg-surface-primary py-1 shadow-lg">
          {invoices.map((inv) => (
            <li key={inv.zohoInvoiceId}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick({
                    invoiceNumber: inv.invoiceNumber,
                    customerName: inv.customerName,
                    zohoCustomerId: inv.zohoCustomerId,
                    total: inv.total,
                    currency: inv.currencyCode ?? 'AED',
                  });
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-secondary"
              >
                <span className="min-w-0">
                  <span className="font-mono">{inv.invoiceNumber}</span>
                  <span className="block truncate text-xs text-text-muted">
                    {inv.customerName} · {dayLabel(new Date(inv.invoiceDate).toISOString())}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">{money(inv.total, inv.currencyCode ?? 'AED')}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default ZohoInvoiceInput;
