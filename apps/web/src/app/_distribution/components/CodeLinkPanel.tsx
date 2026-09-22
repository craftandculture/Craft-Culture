'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

interface CodeLinkPanelProps {
  outletId: string | null;
  /** The owner the page is filtered to, so this agrees with the banner */
  ownerId: string | null;
  onLinked: () => void | Promise<void>;
}

/**
 * Tie the wines no code reaches to the distributor's lines
 *
 * Most wines cross by code and never appear here. What is left is the wine the
 * distributor coded in a way nothing of ours has ever recorded — four of them
 * at City Drinks today, against four of ours with no position.
 *
 * The ranking is by name, and names cannot decide this: "Margaux" is a château
 * and also the appellation half of Bordeaux sits in, so the right wine and the
 * wrong one score alike. An earlier attempt to let names decide matched ten
 * wines of thirteen and got every one wrong. So this proposes and a person
 * disposes, and the arithmetic sits beside each candidate — stock plus sales
 * above everything we ever sent is the wrong wine, not a near miss.
 *
 * Confirmed once, kept forever.
 */
const CodeLinkPanel = ({ outletId, ownerId, onLinked }: CodeLinkPanelProps) => {
  const api = useTRPC();

  const suggestions = useQuery({
    ...api.distribution.admin.getCodeSuggestions.queryOptions({
      outletId: outletId ?? '',
      ownerId: ownerId || null,
    }),
    enabled: Boolean(outletId),
  });

  const link = useMutation(
    api.distribution.admin.linkCode.mutationOptions({
      onSuccess: async (result) => {
        toast.success(`Linked ${result.outletCode}`);
        await suggestions.refetch();
        await onLinked();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const data = suggestions.data;

  if (!outletId || suggestions.isPending) return null;

  /*
    A wine with no candidate is a row that says nothing and cannot be acted on.
    Worth a count, not a hundred lines of "no candidate close enough" — that is
    what the page looked like when a shared vintage was scoring as a match.
  */
  const actionable = data?.suggestions.filter(
    (wine) => wine.candidates.length > 0,
  );
  const silent = (data?.suggestions.length ?? 0) - (actionable?.length ?? 0);

  /* Nothing to do is worth saying once, quietly, rather than an empty card */
  if (!data || data.suggestions.length === 0) {
    return (
      <Typography variant="bodyXs" colorRole="muted" asChild>
        <p>
          Every wine reaches the distributor by code
          {data ? ` — ${data.mappedByCode} of them` : ''}. Nothing to link.
        </p>
      </Typography>
    );
  }

  /*
    Unreached, but nothing to offer — say that rather than claim every wine
    is mapped, which is the opposite of the truth.
  */
  if (!actionable || actionable.length === 0) {
    return (
      <Typography variant="bodyXs" colorRole="muted" asChild>
        <p className="max-w-3xl">
          {silent} of ours reach the distributor under no code, and none of
          their {data.unlinkedTheirs} unclaimed lines shares a word with ours.
          Nothing here can be closed by name.
        </p>
      </Typography>
    );
  }

  return (
    <div className="space-y-2">
      <Typography variant="labelSm" asChild>
        <h2>Wines no code reaches</h2>
      </Typography>
      <Typography variant="bodyXs" colorRole="muted" asChild>
        <p className="max-w-3xl">
          {actionable.length} of ours can be offered a candidate, out of{' '}
          {data.unlinkedOurs} under no code against {data.unlinkedTheirs} of
          theirs. Names are ranked as a suggestion only — check the vintage and
          the bottle count before confirming, because a wrong link settles
          money against the wrong wine.
        </p>
      </Typography>

      <div className="border-border-primary divide-border-muted divide-y rounded-xl border">
        {actionable?.map((wine) => (
          <div key={`${wine.lwin18}-${wine.ownerName}`} className="p-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Typography variant="bodySm" asChild>
                <span className="font-medium">{wine.ourProductName}</span>
              </Typography>
              <Badge colorRole="primary" size="sm">
                {wine.ownerName}
              </Badge>
              <Typography variant="bodyXs" colorRole="muted" asChild>
                <span className="tabular-nums">
                  {wine.outBottles} btl out · {wine.lwin18}
                </span>
              </Typography>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
                {wine.candidates.map((candidate) => (
                  <button
                    key={candidate.outletCode}
                    type="button"
                    disabled={link.isPending}
                    onClick={() =>
                      link.mutate({
                        outletId,
                        outletCode: candidate.outletCode,
                        lwin18: wine.lwin18,
                        outletProductName: candidate.theirProductName,
                        ourProductName: wine.ourProductName,
                      })
                    }
                    className="border-border-primary hover:border-fill-brand hover:bg-fill-muted/30 focus-visible:ring-fill-brand max-w-sm rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
                  >
                    <Typography variant="bodyXs" asChild>
                      <span className="block">{candidate.theirProductName}</span>
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" asChild>
                      <span className="block tabular-nums">
                        {candidate.outletCode} · {candidate.bottlesOnHand} btl
                        {candidate.soldLast30d === null
                          ? ''
                          : ` · ${candidate.soldLast30d} sold 30d`}
                      </span>
                    </Typography>
                    {/*
                      The check that catches what the name cannot. Shown rather
                      than used to hide the candidate, because the arithmetic
                      can also fail for an honest reason — a pack read wrong.
                    */}
                    {candidate.arithmeticHolds ? null : (
                      <Typography variant="bodyXs" colorRole="warning" asChild>
                        <span className="block">
                          They hold more than we ever sent — check this one.
                        </span>
                      </Typography>
                    )}
                  </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {silent > 0 ? (
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p>
            {silent} more of ours reach no candidate by name. Either they hold
            none of it, or their name for it shares no word with ours — neither
            is something a guess should close.
          </p>
        </Typography>
      ) : null}

      {data.unlinkedTheirs > 0 ? (
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p>
            {data.unlinkedTheirs} of their lines are still unclaimed. A wine
            they hold that we never invoiced on consignment is worth knowing
            about rather than linking away.
          </p>
        </Typography>
      ) : null}
    </div>
  );
};

export default CodeLinkPanel;
