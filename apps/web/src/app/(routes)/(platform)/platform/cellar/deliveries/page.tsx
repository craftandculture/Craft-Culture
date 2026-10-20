'use client';

import { IconArrowRight, IconTruckDelivery } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import DeliveriesPanel from '@/app/_cellar/components/DeliveriesPanel';
import useTRPC from '@/lib/trpc/browser';

/** Requests still being arranged; accepted ones are shown by the panel itself */
const IN_PROGRESS = ['submitted', 'under_review', 'revision_requested', 'quoted'];

/**
 * Deliveries in one place, for the phone's Deliveries tab
 *
 * The same panels the cellar page shows, under way above and delivered below.
 * A request still being arranged, or a quote to accept, is handled on Your
 * cellar where the wine is, so it is pointed to rather than repeated here.
 */
const DeliveriesPage = () => {
  const api = useTRPC();
  const { data, isLoading } = useQuery(api.cellar.member.getReleases.queryOptions());

  const requests = data?.requests ?? [];
  const arranging = requests.filter((request) => IN_PROGRESS.includes(request.status));
  const accepted = requests.filter((request) => request.status === 'confirmed');

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Deliveries</h1>
        <p className="text-text-muted mt-1 text-sm">
          Wine on its way to you, and deliveries already made. To request one, open a wine in Your cellar.
        </p>
      </div>

      {arranging.length > 0 && (
        <Link
          href="/platform/cellar"
          className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm dark:bg-emerald-500/10"
        >
          <span className="text-text-primary">
            {arranging.length === 1 ? 'One delivery request is' : `${arranging.length} delivery requests are`} being
            arranged
          </span>
          <span className="text-text-primary inline-flex shrink-0 items-center gap-1 font-semibold">
            View <IconArrowRight size={15} />
          </span>
        </Link>
      )}

      {isLoading ? (
        <p className="text-text-muted py-10 text-center text-sm">Loading your deliveries…</p>
      ) : accepted.length === 0 && arranging.length === 0 ? (
        <div className="border-border-muted flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-black/[0.05] dark:bg-white/[0.08]">
            <IconTruckDelivery size={24} className="text-text-primary" />
          </span>
          <p className="text-text-primary text-sm font-medium">No deliveries yet</p>
          <p className="text-text-muted max-w-xs text-sm">
            When you request a delivery from your cellar, you can follow it here until it reaches you.
          </p>
          <Link
            href="/platform/cellar"
            className="bg-text-primary text-surface-primary mt-1 rounded-lg px-4 py-2.5 text-sm font-semibold"
          >
            Go to your cellar
          </Link>
        </div>
      ) : (
        <>
          <DeliveriesPanel requests={requests} section="live" />
          <DeliveriesPanel requests={requests} section="past" />
        </>
      )}
    </div>
  );
};

export default DeliveriesPage;
