'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import useTRPC from '@/lib/trpc/browser';

import InvoiceLinesPreview from './InvoiceLinesPreview';

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/**
 * Start an export invoice: one consignee, then the invoices going out
 *
 * Each invoice opens to show its lines, read live from Zoho. Invoices already
 * on an issued export invoice are marked and left out of "select all";
 * re-exporting one is nearly always a mistake.
 */
const NewExportInvoiceClient = () => {
  const api = useTRPC();
  const router = useRouter();
  const [customerId, setCustomerId] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);

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
      router.push(`/platform/admin/logistics/export-invoices/${result.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const consignee = consignees.data?.find((c) => c.zohoCustomerId === customerId);
  const filtered = (consignees.data ?? []).filter((c) => c.displayName.toLowerCase().includes(search.trim().toLowerCase()));
  const rows = invoices.data ?? [];
  const eligible = rows.filter((i) => !i.issuedOn);
  const chosen = rows.filter((i) => selected.includes(i.zohoInvoiceId));
  const allSelected = eligible.length > 0 && eligible.every((i) => selected.includes(i.zohoInvoiceId));
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const chooseConsignee = (id: string) => {
    setCustomerId(id);
    setSelected([]);
    setExpanded([]);
  };

  return (
    <div className="grid gap-6 pb-24 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* Step 1 */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">1 · Consignee</p>
        {consignee && (
          <div className="flex items-center justify-between rounded-xl border border-border-brand bg-fill-brand/10 px-3 py-2.5 lg:hidden">
            <span className="text-sm font-medium">{consignee.displayName}</span>
            <Button size="xs" variant="ghost" onClick={() => setCustomerId('')}>Change</Button>
          </div>
        )}
        <div className={`space-y-2 ${consignee ? 'hidden lg:block' : ''}`}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search consignees"
            className="w-full rounded-lg border border-border-primary bg-fill-primary px-3 py-2 text-sm"
          />
          <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
            {consignees.isLoading &&
              [0, 1, 2, 3].map((i) => <li key={i} className="h-11 animate-pulse rounded-lg bg-fill-muted/50" />)}
            {filtered.map((c) => (
              <li key={c.zohoCustomerId}>
                <button
                  type="button"
                  onClick={() => chooseConsignee(c.zohoCustomerId)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    c.zohoCustomerId === customerId
                      ? 'border-border-brand bg-fill-brand/10'
                      : 'border-border-muted bg-fill-primary hover:bg-fill-muted/40'
                  }`}
                >
                  <span>{c.displayName}</span>
                  {c.hasProfile && (
                    <span className="shrink-0 rounded-full bg-fill-brand/15 px-2 py-0.5 text-[10px] font-medium text-text-brand">Set up</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Step 2 */}
      <section className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">2 · Invoices going out</p>
          {eligible.length > 0 && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => setSelected(allSelected ? [] : eligible.map((i) => i.zohoInvoiceId))}
            >
              {allSelected ? 'Clear selection' : `Select all not yet exported (${eligible.length})`}
            </Button>
          )}
        </div>

        {!customerId ? (
          <div className="rounded-xl border border-dashed border-border-muted p-8 text-center text-sm text-text-muted">
            Choose who the shipment is going to.
          </div>
        ) : invoices.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-fill-muted/50" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-muted p-8 text-center text-sm text-text-muted">
            No invoices for this consignee in the last 120 days.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-muted bg-fill-primary">
            <ul className="divide-y divide-border-muted">
              {rows.map((inv) => {
                const open = expanded.includes(inv.zohoInvoiceId);
                const checked = selected.includes(inv.zohoInvoiceId);
                return (
                  <Fragment key={inv.zohoInvoiceId}>
                    <li className={`flex items-center gap-3 px-3 py-2.5 ${checked ? 'bg-fill-brand/5' : ''}`}>
                      <input
                        type="checkbox"
                        aria-label={`Include ${inv.invoiceNumber}`}
                        checked={checked}
                        onChange={() => setSelected((s) => toggle(s, inv.zohoInvoiceId))}
                        className="size-4 shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => setExpanded((e) => toggle(e, inv.zohoInvoiceId))}
                        className="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 text-left sm:grid-cols-[8rem_6rem_minmax(0,1fr)_auto_auto]"
                        aria-expanded={open}
                      >
                        <span className="text-sm font-semibold">{inv.invoiceNumber}</span>
                        <span className="text-right text-sm tabular-nums sm:order-4">
                          {inv.currencyCode} {money(inv.total)}
                        </span>
                        <span className="text-xs text-text-muted sm:order-2">
                          {new Date(inv.invoiceDate).toLocaleDateString('en-GB')}
                        </span>
                        <span className="truncate text-xs text-text-muted sm:order-3">
                          {[inv.referenceNumber, inv.subject].filter(Boolean).join(' · ')}
                          {inv.issuedOn && <span className="ml-2 rounded-full bg-fill-warning/15 px-2 py-0.5 text-[10px] font-medium text-text-warning">On {inv.issuedOn}</span>}
                          {!inv.issuedOn && inv.inDraft && <span className="ml-2 rounded-full bg-fill-muted px-2 py-0.5 text-[10px] text-text-muted">In a draft</span>}
                        </span>
                        <span className={`hidden text-text-muted transition-transform sm:order-5 sm:inline ${open ? 'rotate-90' : ''}`}>›</span>
                      </button>
                    </li>
                    {open && (
                      <li className="bg-fill-muted/20">
                        <InvoiceLinesPreview zohoInvoiceId={inv.zohoInvoiceId} />
                      </li>
                    )}
                  </Fragment>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* Sticky build bar */}
      {customerId && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-muted bg-fill-primary/95 backdrop-blur">
          <div className="container flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="text-sm">
              <span className="font-semibold">{chosen.length}</span> invoice{chosen.length === 1 ? '' : 's'} ·{' '}
              <span className="tabular-nums">USD {money(chosen.reduce((s, i) => s + i.total, 0))}</span>
              {chosen.some((i) => i.issuedOn) && (
                <span className="ml-2 text-xs text-text-warning">includes an invoice already exported</span>
              )}
            </div>
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
        </div>
      )}
    </div>
  );
};

export default NewExportInvoiceClient;
