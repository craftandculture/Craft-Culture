'use client';

import { useQuery } from '@tanstack/react-query';

import useTRPC from '@/lib/trpc/browser';

import BringWineIn from './BringWineIn';
import CellarSetupBanner from './CellarSetupBanner';
import IncomingTransferCard from './IncomingTransferCard';
import MembershipSummary from './MembershipSummary';
import wineSources from '../constants/wineSources';

/**
 * The top of a member's cellar: what to finish, what is coming in, and the
 * membership
 *
 * Shows only what applies. On a wide screen the transfers and the way to
 * bring wine in take two thirds and the membership sits beside them; on a
 * phone everything stacks, setup first. Nothing here blocks looking around;
 * the ID is asked for again when they first act.
 */
const CellarOverviewPanel = () => {
  const api = useTRPC();
  const { data, refetch } = useQuery(api.onboarding.member.overview.queryOptions());

  if (!data) return null;

  // Only wine actually on its way gets a tracker
  const transfers = data.intakes.filter(
    (intake) => wineSources.find((item) => item.value === intake.source)?.isTransfer,
  );

  return (
    <div className="mb-6 space-y-4">
      {data.missing.length > 0 && <CellarSetupBanner missing={data.missing} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {transfers.map((intake) => (
            <IncomingTransferCard key={intake.id} intake={intake} />
          ))}
          <BringWineIn onAdded={() => void refetch()} />
        </div>
        <MembershipSummary overview={data} />
      </div>
    </div>
  );
};

export default CellarOverviewPanel;
