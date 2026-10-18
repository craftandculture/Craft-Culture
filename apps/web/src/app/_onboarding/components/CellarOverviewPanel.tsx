'use client';

import { useQuery } from '@tanstack/react-query';

import useTRPC from '@/lib/trpc/browser';

import BringWineIn from './BringWineIn';
import CellarSetupBanner from './CellarSetupBanner';
import IncomingTransferCard from './IncomingTransferCard';
import MembershipSummary from './MembershipSummary';
import wineSources from '../constants/wineSources';

export interface CellarOverviewPanelProps {
  /**
   * 'setup' is what the member still has to finish, shown above the wine;
   * 'details' is transfers, bringing wine in and the membership, shown after
   * it. The page decides the order — the wine is the hero.
   */
  section: 'setup' | 'details';
}

/** How long a finished transfer stays on screen before it folds away */
const ARRIVED_SHOWN_DAYS = 14;

/**
 * The member's cellar beyond the wine itself
 *
 * Shows only what applies. On a wide screen the transfers and the way to
 * bring wine in take two thirds and the membership sits beside them; on a
 * phone everything stacks. Nothing here blocks looking around; the ID is
 * asked for again when they first act.
 */
const CellarOverviewPanel = ({ section }: CellarOverviewPanelProps) => {
  const api = useTRPC();
  const { data, refetch } = useQuery(api.onboarding.member.overview.queryOptions());

  if (!data) return null;

  if (section === 'setup') {
    return data.missing.length > 0 ? (
      <div className="mb-6">
        <CellarSetupBanner missing={data.missing} />
      </div>
    ) : null;
  }

  const cutoff = Date.now() - ARRIVED_SHOWN_DAYS * 24 * 60 * 60 * 1000;

  /*
    Only wine actually on its way gets a tracker. One that has arrived stays a
    fortnight, as a confirmation, then folds away: the wine itself is in the
    collection by then, and a list of every transfer ever made would push the
    live ones down.
  */
  const transfers = data.intakes.filter(
    (intake) =>
      wineSources.find((item) => item.value === intake.source)?.isTransfer &&
      (intake.stage !== 'in_cellar' || new Date(intake.updatedAt).getTime() > cutoff),
  );

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {transfers.map((intake) => (
          <IncomingTransferCard key={intake.id} intake={intake} />
        ))}
        <BringWineIn onAdded={() => void refetch()} />
      </div>
      <MembershipSummary overview={data} />
    </div>
  );
};

export default CellarOverviewPanel;
