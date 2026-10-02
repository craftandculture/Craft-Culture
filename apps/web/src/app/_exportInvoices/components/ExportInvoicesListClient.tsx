'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import useTRPC from '@/lib/trpc/browser';

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/** Export invoices, drafts and issued, newest first */
const ExportInvoicesListClient = () => {
  const api = useTRPC();
  const { data, isLoading } = useQuery(api.exportInvoices.admin.getMany.queryOptions());

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button colorRole="brand" size="sm" asChild>
          <Link href="/platform/admin/export-invoices/new">New export invoice</Link>
        </Button>
      </div>
      {isLoading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : !data?.length ? (
        <p className="text-sm text-text-muted">No export invoices yet. Start one from a consignee&rsquo;s invoices.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-muted">
          <table className="w-full text-sm">
            <thead className="bg-fill-muted/50 text-left text-xs uppercase text-text-muted">
              <tr>
                <th className="px-3 py-2">Number</th>
                <th className="px-3 py-2">Consignee</th>
                <th className="px-3 py-2">Invoices</th>
                <th className="px-3 py-2 text-right">Cases</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-t border-border-muted/60 hover:bg-fill-muted/30">
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/platform/admin/export-invoices/${row.id}`} className="hover:underline">
                      {row.number ?? 'Draft'}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.consigneeName}</td>
                  <td className="px-3 py-2 text-xs text-text-muted">
                    {row.invoices.length > 4 ? `${row.invoices.slice(0, 4).join(', ')} +${row.invoices.length - 4}` : row.invoices.join(', ')}
                  </td>
                  <td className="px-3 py-2 text-right">{row.cases ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{row.total === null ? '—' : `${row.currency} ${money(row.total)}`}</td>
                  <td className="px-3 py-2">
                    <Badge colorRole={row.status === 'issued' ? 'success' : 'warning'} size="sm">
                      {row.status === 'issued' ? 'Issued' : 'Draft'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ExportInvoicesListClient;
