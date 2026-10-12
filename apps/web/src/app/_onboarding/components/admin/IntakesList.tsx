'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import intakeStages from '../../constants/intakeStages';
import wineSources from '../../constants/wineSources';

/**
 * Every transfer members have asked for, and the stage it is at
 *
 * Changing the stage moves the member's Incoming card and tells them. Closed
 * transfers are hidden unless asked for.
 */
const IntakesList = () => {
  const api = useTRPC();
  const [showClosed, setShowClosed] = useState(false);
  const { data = [], refetch } = useQuery(api.onboarding.admin.listIntakes.queryOptions());
  const setStage = useMutation(
    api.onboarding.admin.setIntakeStage.mutationOptions({
      onSuccess: () => {
        toast.success('Stage updated — the member has been told');
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const shown = data.filter(({ intake }) => showClosed || !['closed', 'in_cellar'].includes(intake.stage));

  return (
    <div className="space-y-3">
      <label className="text-text-muted flex items-center gap-2 text-xs">
        <input type="checkbox" checked={showClosed} onChange={(event) => setShowClosed(event.target.checked)} />
        Show finished and closed
      </label>
      <div className="border-border-muted bg-surface-primary divide-border-muted divide-y rounded-xl border shadow-sm">
        {shown.length === 0 && <p className="text-text-muted px-4 py-10 text-center text-sm">No transfers in progress.</p>}
        {shown.map(({ intake, memberName }) => (
          <div key={intake.id} className="hover:bg-surface-secondary/50 flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-text-primary text-sm font-semibold">
                {memberName} · {wineSources.find((source) => source.value === intake.source)?.label ?? intake.source}
              </p>
              <p className="text-text-muted text-xs">
                {[
                  intake.holderName,
                  intake.approxCases && `~${intake.approxCases} cases`,
                  intake.holderAccountRef && `acct ${intake.holderAccountRef}`,
                  intake.note,
                  intake.tastes,
                  formatDistanceToNowStrict(new Date(intake.createdAt), { addSuffix: true }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <select
              value={intake.stage}
              disabled={setStage.isPending}
              onChange={(event) =>
                setStage.mutate({
                  intakeId: intake.id,
                  stage: event.target.value as (typeof intakeStages)[number]['value'] | 'closed',
                })
              }
              className="border-border-muted bg-surface-primary text-text-primary h-9 rounded-lg border px-2 text-xs font-semibold"
            >
              {intakeStages.map((stage) => (
                <option key={stage.value} value={stage.value}>
                  {stage.label}
                </option>
              ))}
              <option value="closed">Closed</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IntakesList;
