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
 * Claim the distributor's lines that reach no wine of ours
 *
 * One row per line of theirs, because that is how many questions there are:
 * City Drinks hold four bottles under a blank supplier code, and each needs
 * one wine of ours chosen. Asked the other way round it became a hundred rows
 * of our wines each guessing at four lines, which is the same four answers
 * buried in everything we ever sent them.
 *
 * The ranking is by name and decides nothing. "Margaux" is a château and also
 * the appellation half of Bordeaux sits in, so the right wine and the wrong
 * one score alike; a search box sits beside the suggestions because the answer
 * is often a wine no name would have proposed. The arithmetic is the real
 * check — their stock plus a month's sales above everything we invoiced out is
 * the wrong wine, not a near miss — so it sits against each candidate.
 *
 * The owner chip does not narrow this, and must not. An unclaimed line has no
 * owner yet — choosing the wine is what gives it one — so the candidates span
 * every owner and each says whose it is. Narrowed, it offered Cult's wines as
 * answers for a line that was never Cult's.
 *
 * Worth saying plainly: this exists because four fields in their product
 * master are empty. Filled at their end, every one of these lines maps itself
 * on the next pull and this panel disappears.
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
        <h2>Lines of theirs that reach no wine of ours</h2>
      </Typography>
      <Typography variant="bodyXs" colorRole="muted" asChild>
        <p className="max-w-3xl">
          {data.lines.length} of their consigned lines carry no code of ours, so
          their bottles cannot reach an owner. Each needs one wine chosen, from
          any owner — which owner it belongs to is what choosing decides, so the
          owner filter above does not apply here. Names are a suggestion only
          and the bottle count is the check that catches what a name cannot. The
          lasting fix is theirs: these lines have an empty supplier code in
          their product master.
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
                    No wine of ours shares a word with their name for it. Search
                    below — the right one is here, under a name neither of us
                    writes the same way.
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
                    ? 'Find the wine'
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
          position at this outlet. Most of those they simply hold none of; only
          the lines above are unreachable by code.
        </p>
      </Typography>
    </div>
  );
};

export default CodeLinkPanel;
