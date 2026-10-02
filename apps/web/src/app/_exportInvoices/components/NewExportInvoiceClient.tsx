'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import useTRPC from '@/lib/trpc/browser';

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/**
 * Start an export invoice: one consignee, then the invoices going out
 *
 * Invoices already on an issued export invoice are shown but not ticked by
 * default; re-exporting one is nearly always a mistake.
 */
const NewExportInvoiceClient = () => {
  const api = useTRPC();
  const router = useRouter();
  const [customerId, setCustomerId] = useState<string>('');
  const [selected, setSelected] = useState<string[]>([]);

  const consignees = useQuery(api.exportInvoices.admin.consignees.queryOptions());
  const invoices = useQuery({
    ...api.exportInvoices.admin.invoicesForConsignee.queryOptions({ zohoCustomerId: customerId }),
    enabled: Boolean(customerId),
  });
  const create = useMutation({
    ...api.exportInvoices.admin.createDraft.mutationOptions(),
    onSuccess: (result) => {
      const skipped = result.ruleResults.filter((r) => !r.applied);
      if (skipped.length) toast.warning(`${skipped.length} standing rule${skipped.length > 1 ? 's' : ''} did not apply`);
      router.push(`/platform/admin/export-invoices/${result.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const consignee = consignees.data?.find((c) => c.zohoCustomerId === customerId);
  const chosen = invoices.data?.filter((i) => selected.includes(i.zohoInvoiceId)) ?? [];
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase text-text-muted">1. Consignee</p>
        <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
          {consignees.data?.map((c) => (
            <li key={c.zohoCustomerId}>
              <button
                type="button"
                onClick={() => {
                  setCustomerId(c.zohoCustomerId);
                  setSelected([]);
                }}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  c.zohoCustomerId === customerId ? 'border-border-brand bg-fill-brand/10' : 'border-border-muted hover:bg-fill-muted/40'
                }`}
              >
                {c.displayName}
                {c.hasProfile && <span className="ml-2 text-xs text-text-brand">set up</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase text-text-muted">2. Invoices going out</p>
        {!customerId ? (
          <p className="text-sm text-text-muted">Choose who the shipment is going to.</p>
        ) : invoices.isLoading ? (
          <p className="text-sm text-text-muted">Loading invoices…</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-border-muted">
              <table className="w-full text-sm">
                <thead className="bg-fill-muted/50 text-left text-xs uppercase text-text-muted">
                  <tr>
                    <th className="w-8 px-3 py-2" />
                    <th className="px-3 py-2">Invoice</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Reference</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.data?.map((inv) => (
                    <tr key={inv.zohoInvoiceId} className="border-t border-border-muted/60">
                      <td className="px-3 py-1.5">
                        <input type="checkbox" checked={selected.includes(inv.zohoInvoiceId)} onChange={() => toggle(inv.zohoInvoiceId)} />
                      </td>
                      <td className="px-3 py-1.5 font-medium">{inv.invoiceNumber}</td>
                      <td className="px-3 py-1.5">{new Date(inv.invoiceDate).toLocaleDateString('en-GB')}</td>
                      <td className="px-3 py-1.5 text-xs text-text-muted">{[inv.referenceNumber, inv.subject].filter(Boolean).join(' · ')}</td>
                      <td className="px-3 py-1.5 text-right">{inv.currencyCode} {money(inv.total)}</td>
                      <td className="px-3 py-1.5 text-xs">
                        {inv.issuedOn ? <span className="text-text-warning">on {inv.issuedOn}</span> : inv.inDraft ? <span className="text-text-muted">in a draft</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">
                {chosen.length} invoice{chosen.length === 1 ? '' : 's'} · USD {money(chosen.reduce((s, i) => s + i.total, 0))}
              </span>
              <Button
                colorRole="brand"
                disabled={chosen.length === 0 || create.isPending}
                onClick={() =>
                  create.mutate({
                    zohoCustomerId: customerId,
                    consigneeName: consignee?.displayName ?? '',
                    zohoInvoiceIds: [...chosen]
                      .sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber))
                      .map((i) => i.zohoInvoiceId),
                  })
                }
              >
                {create.isPending ? 'Reading invoices from Zoho…' : 'Build draft'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NewExportInvoiceClient;
