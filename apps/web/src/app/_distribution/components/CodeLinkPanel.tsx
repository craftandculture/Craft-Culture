'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

interface CodeLinkPanelProps {
  outletId: string | null;
  onLinked: () => void | Promise<void>;
}

/** Enough to choose from without becoming a list nobody reads */
const SEARCH_LIMIT = 8;

/**
 * Lines City Drinks call consignment that we never consigned
 *
 * A line's regime comes from one place: the `status` field on their own feed.
 * That is their record of our commercial relationship, and it is sometimes
 * wrong — Tignanello 2022 was invoiced to them as an outright sale and their
 * system still flags it Consigned, so it arrives here as consigned stock with
 * no code of ours against it, because there is no consignment of it to find.
 *
 * So these are not wines waiting to be matched. A line reaching no wine of
 * ours, with nothing we ever invoiced out on consignment to reach, is their
 * own stock wearing our label. It is excluded from the position already; what
 * it needs is correcting at their end, not linking at ours.
 *
 * The link stays for the other case, which is real but rarer: a wine genuinely
 * on consignment whose supplier code they left blank. That one is ours and
 * belongs in the report, so it can be claimed — deliberately as a secondary
 * action, because the likelier answer is that the line is not ours at all.
 *
 * Candidates span every owner and never narrow to the owner chip: an unclaimed
 * line has no owner, and choosing the wine is what would give it one.
 */
const CodeLinkPanel = ({ outletId, onLinked }: CodeLinkPanelProps) => {
  const api = useTRPC();

  /** Which line is being searched against, and for what */
  const [searchFor, setSearchFor] = useState<string | null>(null);
  const [term, setTerm] = useState('');

  const suggestions = useQuery({
    ...api.distribution.admin.getCodeSuggestions.queryOptions({
      outletId: outletId ?? '',
    }),
    enabled: Boolean(outletId),
  });

  const link = useMutation(
    api.distribution.admin.linkCode.mutationOptions({
      onSuccess: async (result) => {
        toast.success(`Linked ${result.outletCode}`);
        setSearchFor(null);
        setTerm('');
        await suggestions.refetch();
        await onLinked();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const data = suggestions.data;

  if (!outletId || suggestions.isPending) return null;

  /* Nothing to do is worth saying once, quietly, rather than an empty card */
  if (!data || data.lines.length === 0) {
    return (
      <Typography variant="bodyXs" colorRole="muted" asChild>
        <p>
          Every line they hold reaches a wine of ours
          {data ? ` — ${data.mappedByCode} of them` : ''}. Nothing to link.
        </p>
      </Typography>
    );
  }

  return (
    <div className="space-y-2">
      <Typography variant="labelSm" asChild>
        <h2>They call these consignment — we never consigned them</h2>
      </Typography>
      <Typography variant="bodyXs" colorRole="muted" asChild>
        <p className="max-w-3xl">
          {data.lines.length} lines carry a Consigned status on their feed and no
          consignment of ours to match it. The regime is read from their status
          field and nothing else, so a wine we sold them outright shows up here
          the moment their record says consignment — Tignanello 2022 is one, on
          an invoice they bought against. None of these count towards the
          position; they are listed so the status gets corrected at their end.
          If one truly is on consignment and they simply left the supplier code
          blank, claim it.
        </p>
      </Typography>

      <div className="border-border-primary divide-border-muted divide-y rounded-xl border">
        {data.lines.map((line) => {
          const matches = data.ourUnmatched
            .filter((wine) =>
              wine.productName.toLowerCase().includes(term.trim().toLowerCase()),
            )
            .slice(0, SEARCH_LIMIT);

          return (
            <div key={line.outletCode} className="p-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <Typography variant="bodySm" asChild>
                  <span className="font-medium">{line.theirProductName}</span>
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" asChild>
                  <span className="tabular-nums">
                    {line.outletCode} · {line.bottlesOnHand} btl
                    {line.soldLast30d === null
                      ? ''
                      : ` · ${line.soldLast30d} sold 30d`}
                  </span>
                </Typography>
              </div>

              {line.candidates.length === 0 ? (
                <Typography variant="bodyXs" colorRole="muted" asChild>
                  <p className="mt-1">
                    Nothing of ours on consignment resembles it, which is what
                    an outright sale mis-flagged at their end looks like.
                  </p>
                </Typography>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {line.candidates.map((candidate) => (
                    <button
                      key={candidate.lwin18}
                      type="button"
                      disabled={link.isPending}
                      onClick={() =>
                        link.mutate({
                          outletId,
                          outletCode: line.outletCode,
                          lwin18: candidate.lwin18,
                          outletProductName: line.theirProductName,
                          ourProductName: candidate.productName,
                        })
                      }
                      className="border-border-primary hover:border-fill-brand hover:bg-fill-muted/30 focus-visible:ring-fill-brand max-w-sm rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
                    >
                      <Typography variant="bodyXs" asChild>
                        <span className="block">{candidate.productName}</span>
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted" asChild>
                        <span className="block tabular-nums">
                          {candidate.ownerName} · {candidate.outBottles} btl out
                        </span>
                      </Typography>
                      {/*
                        Shown rather than used to hide the candidate, because
                        the arithmetic can also fail for an honest reason — a
                        pack read wrong.
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
              )}

              {searchFor === line.outletCode ? (
                <div className="mt-2 space-y-1">
                  <input
                    type="search"
                    autoFocus
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    placeholder="Search our wines by name"
                    className="border-border-primary focus-visible:ring-fill-brand w-full max-w-sm rounded-lg border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2"
                  />
                  {matches.map((wine) => (
                    <button
                      key={wine.lwin18}
                      type="button"
                      disabled={link.isPending}
                      onClick={() =>
                        link.mutate({
                          outletId,
                          outletCode: line.outletCode,
                          lwin18: wine.lwin18,
                          outletProductName: line.theirProductName,
                          ourProductName: wine.productName,
                        })
                      }
                      className="hover:bg-fill-muted/30 block w-full max-w-sm rounded-lg px-2 py-1 text-left disabled:opacity-50"
                    >
                      <Typography variant="bodyXs" asChild>
                        <span className="block">{wine.productName}</span>
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted" asChild>
                        <span className="block tabular-nums">
                          <Badge colorRole="primary" size="sm">
                            {wine.ownerName}
                          </Badge>{' '}
                          {wine.outBottles} btl out · {wine.lwin18}
                        </span>
                      </Typography>
                    </button>
                  ))}
                  {matches.length === 0 ? (
                    <Typography variant="bodyXs" colorRole="muted" asChild>
                      <p>No wine of ours matches that.</p>
                    </Typography>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSearchFor(line.outletCode);
                    setTerm('');
                  }}
                  className="text-text-muted hover:text-text-primary mt-2 text-xs underline"
                >
                  {line.candidates.length === 0
                    ? 'It is ours — find the wine'
                    : 'None of these — search'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <Typography variant="bodyXs" colorRole="muted" asChild>
        <p className="max-w-3xl">
          {data.ourUnmatched.length} wines of ours, across every owner, show no
          position at this outlet — in almost every case because they hold none
          of it, which is the ordinary end of a consignment.
        </p>
      </Typography>
    </div>
  );
};

export default CodeLinkPanel;
