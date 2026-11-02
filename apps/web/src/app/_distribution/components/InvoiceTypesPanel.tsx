'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import { INVOICE_TYPES, INVOICE_TYPE_LABELS } from '../utils/classifyInvoice';
import type { InvoiceType } from '../utils/classifyInvoice';

export interface InvoiceTypesPanelProps {
  outletId: string | null;
}

/** Shown open only when something needs looking at; the list is long */
const COLLAPSED_ROWS = 8;

/**
 * Every invoice to the outlet, with whether its sales are billed and paid
 *
 * Consignment is billed to the outlet and paid to the owner. Prepaid and
 * outright stock is already the outlet's, so its sales move no money and are
 * drawn down first. The type is read from the document and can be corrected
 * here; a correction is kept and holds on every later sync.
 *
 * @example
 *   <InvoiceTypesPanel outletId={outletId} />
 */
const InvoiceTypesPanel = ({ outletId }: InvoiceTypesPanelProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);

  const invoices = useQuery({
    ...api.distribution.admin.getInvoices.queryOptions({
      outletId: outletId ?? '',
    }),
    enabled: Boolean(outletId),
  });

  const setType = useMutation({
    ...api.distribution.admin.setInvoiceType.mutationOptions(),
    onSuccess: async (result) => {
      toast.success(
        result.needsSync
          ? `${result.docRef} updated. Run "Sync invoices from Zoho", then match the month again.`
          : `${result.docRef} updated. Match the month again to apply it.`,
      );
      await Promise.all(
        [
          api.distribution.admin.getInvoices.queryKey(),
          api.distribution.admin.getStatement.queryKey(),
          api.distribution.admin.getMonthSummary.queryKey(),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = invoices.data?.invoices ?? [];

  if (!outletId || rows.length === 0) return null;

  const shown = showAll ? rows : rows.slice(0, COLLAPSED_ROWS);
  const counts = rows.reduce<Record<string, number>>((totals, row) => {
    const type = row.invoiceType ?? 'consignment';

    totals[type] = (totals[type] ?? 0) + 1;

    return totals;
  }, {});

  return (
    <div className="border-border-primary space-y-3 rounded-xl border p-4">
      <div>
        <Typography variant="labelSm" asChild>
          <h2>Invoices to this outlet</h2>
        </Typography>
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p className="mt-1 max-w-3xl">
            Only consignment is billed to City Drinks and paid to the owner.
            Prepaid and outright stock is already theirs: sales from it move no
            money, and are drawn down before any consignment line of the same
            wine.{' '}
            {INVOICE_TYPES.filter((type) => counts[type])
              .map((type) => `${counts[type]} ${INVOICE_TYPE_LABELS[type].toLowerCase()}`)
              .join(' · ')}
          </p>
        </Typography>
      </div>

      <div className="divide-border-muted divide-y">
        {shown.map((row) => (
          <div
            key={row.docRef}
            className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          >
            <div className="min-w-0">
              <Typography variant="bodySm" asChild>
                <span className="tabular-nums">
                  {row.docRef}
                  <span className="text-text-muted">
                    {row.docDate ? ` · ${row.docDate}` : ''} · {row.bottles} btl
                  </span>
                </span>
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" asChild>
                <p className="truncate">{row.owners.join(', ')}</p>
              </Typography>
            </div>
            <label className="flex items-center gap-2">
              {row.setByHand ? (
                <span className="text-text-muted text-xs">set by hand</span>
              ) : null}
              <select
                value={row.invoiceType ?? 'consignment'}
                disabled={setType.isPending}
                onChange={(event) =>
                  setType.mutate({
                    outletId,
                    docRef: row.docRef,
                    invoiceType: event.target.value as InvoiceType,
                  })
                }
                className="border-border-primary bg-fill-primary text-text-primary min-h-9 rounded-md border px-2 text-sm"
              >
                {INVOICE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {INVOICE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              {row.setByHand ? (
                <button
                  type="button"
                  className="text-text-muted text-xs hover:underline"
                  onClick={() =>
                    setType.mutate({
                      outletId,
                      docRef: row.docRef,
                      invoiceType: null,
                    })
                  }
                >
                  Reset
                </button>
              ) : null}
            </label>
          </div>
        ))}
      </div>

      {rows.length > COLLAPSED_ROWS ? (
        <button
          type="button"
          className="text-text-muted text-xs hover:underline"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'Show fewer' : `Show all ${rows.length} invoices`}
        </button>
      ) : null}
    </div>
  );
};

export default InvoiceTypesPanel;
