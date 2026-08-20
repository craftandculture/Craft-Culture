'use client';

import { IconArrowRight } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

export interface NextStepProps {
  /** Which consignment programme's work to advise on */
  programmeId: string | null;
  periodId: string | null;
  /** Move to another tab, so the advice is one click from being followed */
  onGo: (tab: string) => void;
}

/**
 * The one thing worth doing next, and where to do it
 *
 * Five tabs and no order to them meant the commonest question about this tool
 * was "what do I do now" — and reading the figures before the inputs are
 * straight produces variances that are artefacts of the data being incomplete,
 * which is worse than no answer because someone acts on it.
 *
 * The order encoded here is the order the work actually has to happen in:
 * nothing counts until it is committed, nothing reconciles until it is mapped,
 * and no figure means anything while a wine is counted twice.
 */
const NextStep = ({ programmeId, periodId, onGo }: NextStepProps) => {
  const api = useTRPC();

  const triangulation = useQuery(
    api.triangulation.admin.getTriangulation.queryOptions({
      programmeId,
      periodId,
    }),
  );
  const doubleCounts = useQuery(
    api.triangulation.admin.findDoubleCounts.queryOptions(),
  );

  const meta = triangulation.data?.meta;

  if (!meta) return null;

  const steps = [
    {
      when: (doubleCounts.data?.length ?? 0) > 0,
      title: `${doubleCounts.data?.length} wines are counted from two sources`,
      hint: 'Until this is settled every figure for those wines is inflated, so nothing else is worth reading.',
      action: 'Show me',
      tab: 'overview',
    },
    {
      when: meta.draftImports > 0,
      title: `${meta.draftImports} imports are not committed`,
      hint: 'A draft contributes nothing to the reconciliation, so its bottles read as missing.',
      action: 'Go to Imports',
      tab: 'imports',
    },
    {
      when: meta.unmappedCodes > 0,
      title: `${meta.unmappedCodes} codes do not resolve to a wine`,
      hint: 'Their bottles are excluded, which understates one side and leaves a variance nobody can explain.',
      action: 'Go to Mapping',
      tab: 'mapping',
    },
    {
      when: meta.presentKinds.length < 5,
      title: 'Not every input has arrived yet',
      hint: 'The reconciliation compares five inputs, and a missing one reads as a shortfall rather than an absence.',
      action: 'Go to Imports',
      tab: 'imports',
    },
  ];

  const next = steps.find((step) => step.when);

  if (!next) {
    return (
      <div className="border-border-success/40 bg-fill-success/10 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
        <div>
          <Typography variant="labelSm" colorRole="success">
            The inputs are straight — the figures can be read as they stand
          </Typography>
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p className="mt-0.5">
              Everything committed, every code mapped, nothing counted twice.
              Any variance left is a real one.
            </p>
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className="border-border-warning/40 bg-fill-warning/10 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
      <div className="min-w-0">
        <Typography variant="labelSm" colorRole="warning">
          Next: {next.title}
        </Typography>
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p className="mt-0.5 max-w-3xl">{next.hint}</p>
        </Typography>
      </div>
      <Button size="sm" colorRole="brand" onClick={() => onGo(next.tab)}>
        {next.action}
        <IconArrowRight className="ml-1 size-4" />
      </Button>
    </div>
  );
};

export default NextStep;
