'use client';

import { IconChevronRight, IconCircleCheck } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

export interface HomeAttentionCardProps {
  /** Overdue invoices, already counted for the tiles above */
  overdueInvoices: number;
}

/** Dot colour by how soon someone needs to act */
const DOTS = {
  urgent: 'bg-red-500',
  action: 'bg-amber-500',
  chase: 'bg-blue-500',
} as const;

/**
 * What is waiting on the team today, across the whole business
 *
 * Built only from counts other screens already keep (orders, Private Cellar,
 * logistics, invoices), so it cannot disagree with them: each line opens the
 * list it was counted from. A line shows only when something is under it.
 *
 * @example
 *   <HomeAttentionCard overdueInvoices={12} />
 */
const HomeAttentionCard = ({ overdueInvoices }: HomeAttentionCardProps) => {
  const api = useTRPC();
  const trpcClient = useTRPCClient();

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['privateClientOrders.adminDashboard'],
    queryFn: () => trpcClient.privateClientOrders.adminDashboard.query(),
  });
  const { data: cellar, isLoading: cellarLoading } = useQuery(
    api.cellar.admin.getAttention.queryOptions(),
  );
  const { data: logistics, isLoading: logisticsLoading } = useQuery(
    api.logistics.admin.getAttention.queryOptions(),
  );

  const cellarCount = (tone: string) =>
    (cellar?.groups ?? [])
      .filter((group) => group.tone === tone)
      .reduce((sum, group) => sum + group.count, 0);

  // A shipment can be late and quiet at once; count it once
  const shipmentsNeedingAttention = new Set(
    (logistics ?? []).flatMap((group) => group.shipments.map((shipment) => shipment.id)),
  ).size;

  const lines: {
    label: string;
    count: number;
    href?: string;
    tone: keyof typeof DOTS;
  }[] = [
    {
      label: 'Private Cellar: do today',
      count: cellarCount('urgent'),
      href: '/platform/admin/cellar-members',
      tone: 'urgent',
    },
    {
      label: 'Orders blocked by a missing CD SKU',
      count: orders?.attention.skuMissing ?? 0,
      href: '/platform/admin/private-orders?skuMissing=1',
      tone: 'urgent',
    },
    {
      label: 'Orders with verification suspended',
      count: orders?.attention.suspended ?? 0,
      href: '/platform/admin/private-orders?status=verification_suspended',
      tone: 'urgent',
    },
    {
      label: 'Orders to review',
      count: orders?.statusBreakdown.pendingReview ?? 0,
      href: '/platform/admin/private-orders?stage=review',
      tone: 'action',
    },
    {
      label: 'Orders with no distributor',
      count: orders?.attention.unassigned ?? 0,
      href: '/platform/admin/private-orders?distributor=unassigned',
      tone: 'action',
    },
    {
      label: 'Private Cellar: to decide',
      count: cellarCount('action'),
      href: '/platform/admin/cellar-members',
      tone: 'action',
    },
    {
      label: 'Shipments needing attention',
      count: shipmentsNeedingAttention,
      href: '/platform/admin/logistics',
      tone: 'action',
    },
    {
      label: 'Overdue invoices',
      // Kept in Zoho Books; there is no list of them in Index to open
      count: overdueInvoices,
      tone: 'chase',
    },
  ];

  const open = lines.filter((line) => line.count > 0);
  const isLoading = ordersLoading || cellarLoading || logisticsLoading;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <p className="text-[15px] font-bold">Needs attention</p>
          {open.length > 0 && (
            <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-[11px] font-semibold tabular-nums text-text-muted">
              {open.reduce((sum, line) => sum + line.count, 0)}
            </span>
          )}
        </div>

        {isLoading && open.length === 0 ? (
          <p className="border-t border-border-muted px-6 py-8 text-sm text-text-muted">Loading…</p>
        ) : open.length === 0 ? (
          <div className="flex items-center gap-2 border-t border-border-muted px-6 py-8 text-sm">
            <IconCircleCheck size={18} className="text-emerald-600" />
            <span className="font-semibold text-text-primary">Nothing is waiting on the team.</span>
          </div>
        ) : (
          <ul>
            {open.map((line) => {
              const row = (
                <>
                  <span className={`size-2 shrink-0 rounded-full ${DOTS[line.tone]}`} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text-primary">
                    {line.label}
                  </span>
                  <span className="shrink-0 text-[13px] font-bold tabular-nums">{line.count}</span>
                </>
              );
              const rowClass =
                'group flex items-center gap-3 border-t border-border-muted px-6 py-3.5';

              return (
                <li key={line.label}>
                  {line.href ? (
                    <Link
                      href={line.href}
                      className={`${rowClass} transition-colors hover:bg-surface-secondary/50`}
                    >
                      {row}
                      <IconChevronRight
                        size={16}
                        className="shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
                      />
                    </Link>
                  ) : (
                    <div className={rowClass}>{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default HomeAttentionCard;
