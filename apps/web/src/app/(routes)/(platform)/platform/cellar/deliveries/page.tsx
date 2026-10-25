'use client';

import { IconArrowRight, IconTruckDelivery } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import CellarPageHeader from '@/app/_cellar/components/CellarPageHeader';
import CellarState from '@/app/_cellar/components/CellarState';
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
  const { data, isLoading, isError } = useQuery(api.cellar.member.getReleases.queryOptions());

  const requests = data?.requests ?? [];
  const arranging = requests.filter((request) => IN_PROGRESS.includes(request.status));
  const accepted = requests.filter((request) => request.status === 'confirmed');

  return (
    <div className="flex w-full flex-col gap-4 pb-8">
      <CellarPageHeader
        title="Deliveries"
        description="Deliveries in progress and those already completed. To arrange a new delivery, choose the wines in Your cellar."
        className="mb-1"
      />

      {arranging.length > 0 && (
        <Link
          href="/platform/cellar"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm shadow-sm dark:border-emerald-900 dark:bg-emerald-500/10"
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
        <CellarState kind="loading" />
      ) : isError ? (
        <CellarState kind="error" />
      ) : accepted.length === 0 && arranging.length === 0 ? (
        <CellarState
          kind="empty"
          icon={IconTruckDelivery}
          title="No deliveries yet"
          message="When you request a delivery from your cellar, you can follow it here until it reaches you."
          action={
            <Link
              href="/platform/cellar"
              className="bg-text-primary text-surface-primary inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold"
            >
              Go to your cellar
            </Link>
          }
        />
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
