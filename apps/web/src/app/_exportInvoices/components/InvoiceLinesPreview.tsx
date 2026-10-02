'use client';

import { useQuery } from '@tanstack/react-query';

import useTRPC from '@/lib/trpc/browser';

export interface InvoiceLinesPreviewProps {
  zohoInvoiceId: string;
}

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/**
 * An invoice's lines, opened beneath its row
 *
 * Read live from Zoho the same way the draft will be built, so a line that
 * was dropped or repriced after the invoice was raised shows here first.
 */
const InvoiceLinesPreview = ({ zohoInvoiceId }: InvoiceLinesPreviewProps) => {
  const api = useTRPC();
  const { data, isLoading, error } = useQuery({
    ...api.exportInvoices.admin.invoiceLines.queryOptions({ zohoInvoiceId }),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-1.5 p-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-fill-muted/60" />
        ))}
      </div>
    );
  }
  if (error) return <p className="p-3 text-xs text-text-danger">{error.message}</p>;
  if (!data) return null;

  return (
    <div className="p-3">
      <div className="hidden overflow-hidden rounded-lg border border-border-muted sm:block">
        <table className="w-full text-xs">
          <thead className="bg-fill-muted/50 text-left text-[10px] uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-2 py-1.5">Wine</th>
              <th className="px-2 py-1.5">Pack</th>
              <th className="px-2 py-1.5 text-right">Qty</th>
              <th className="px-2 py-1.5 text-right">Rate</th>
              <th className="px-2 py-1.5 text-right">Billed USD</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((l) => (
              <tr key={l.id} className="border-t border-border-muted/60 odd:bg-fill-muted/20">
                <td className="px-2 py-1.5">
                  {l.description}
                  {l.lwin18 && <span className="ml-2 font-mono text-[10px] text-text-muted">{l.lwin18}</span>}
                </td>
                <td className="px-2 py-1.5">{l.pack}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{l.quantity}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{money(l.rate)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {money(l.netUsd)}
                  {l.discounted && <span className="ml-1 text-[10px] text-text-muted">net</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-1.5 sm:hidden">
        {data.lines.map((l) => (
          <li key={l.id} className="rounded-lg border border-border-muted px-2.5 py-2 text-xs">
            <p className="font-medium">{l.description}</p>
            <p className="text-text-muted">
              {l.quantity} × {l.pack} · USD {money(l.netUsd)}
              {l.discounted ? ' net' : ''}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-right text-xs text-text-muted">
        {data.lines.length} line{data.lines.length === 1 ? '' : 's'}
        {data.pcoNumber ? ` · ${data.pcoNumber}` : ''} · invoice total USD {money(data.totalUsd)}
      </p>
    </div>
  );
};

export default InvoiceLinesPreview;
