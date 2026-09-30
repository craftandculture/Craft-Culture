'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

type Result = {
  salesOrderNumber: string | null;
  invoiceNumber: string | null;
  referenceNumber: string | null;
  customerName: string | null;
  reason: string;
  zohoStatus: string | null;
  pickListNumber: string | null;
  pickListId: string | null;
  pickedAt: Date | string | null;
};

const formatDate = (value: Date | string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : '';

/** One plain sentence per reason, written for the person at the scanner. */
const explain = (r: Result) => {
  switch (r.reason) {
    case 'on_list':
      return 'This order is on the list. Clear the readiness filter to see it.';
    case 'not_invoiced':
      return `Not invoiced in Zoho yet (Zoho status: ${r.zohoStatus ?? 'unknown'}). It appears here once it is invoiced.`;
    case 'picking':
      return `Already released to pick${r.pickListNumber ? ` in ${r.pickListNumber}` : ''}, and still being picked.`;
    case 'picked':
      return `Already picked${r.pickListNumber ? ` in ${r.pickListNumber}` : ''}${r.pickedAt ? ` on ${formatDate(r.pickedAt)}` : ''}. It is waiting on the Dispatch screen.`;
    case 'dispatched':
      return 'Already dispatched.';
    case 'cancelled':
      return 'Cancelled in the WMS. If it should still ship, check it in Zoho.';
    case 'not_synced':
      return `In Zoho (status: ${r.zohoStatus ?? 'unknown'}) but not in the WMS. Press refresh; if it is still missing, it is failing to sync and needs looking at.`;
    default:
      return 'No sales order, invoice or subject by that number in the WMS or in Zoho.';
  }
};

/**
 * Explains a searched-for order that is not on the New Pick List screen.
 *
 * Shown in place of the bare "no orders" message whenever a search finds
 * nothing, so an order that was already picked, is not yet invoiced, or never
 * synced says so instead of simply being absent.
 */
const WhereIsOrder = ({ query }: { query: string }) => {
  const api = useTRPC();
  const enabled = query.trim().length >= 4;

  const { data, isLoading } = useQuery({
    ...api.zohoSalesOrders.whereIs.queryOptions({ query: query.trim() }),
    enabled,
  });

  if (!enabled) return null;

  if (isLoading) {
    return (
      <Typography variant="bodySm" colorRole="muted">
        Looking for &ldquo;{query.trim()}&rdquo;…
      </Typography>
    );
  }

  const results = (data?.results ?? []) as Result[];

  return (
    <div className="flex flex-col gap-2 text-left">
      {results.map((r, i) => (
        <div
          key={`${r.salesOrderNumber ?? 'none'}-${i}`}
          className="rounded-lg border border-border-primary bg-fill-secondary px-3 py-2"
        >
          {r.salesOrderNumber && (
            <p className="text-[13px] font-semibold text-text-primary">
              {[r.invoiceNumber, r.salesOrderNumber, r.referenceNumber]
                .filter(Boolean)
                .join(' · ')}
              {r.customerName && (
                <span className="font-normal text-text-muted"> — {r.customerName}</span>
              )}
            </p>
          )}
          <p className="text-[13px] text-text-primary">{explain(r)}</p>
          {r.pickListId && (
            <Link
              href={`/platform/admin/wms/pick/${r.pickListId}`}
              className="text-[12px] font-medium text-text-brand underline"
            >
              Open {r.pickListNumber ?? 'pick list'}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
};

export default WhereIsOrder;
