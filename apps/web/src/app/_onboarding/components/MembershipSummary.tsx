'use client';

import { useMutation } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import Link from 'next/link';

import useTRPC from '@/lib/trpc/browser';
import type { AppRouter } from '@/trpc-router';

import { PRIVATE_CELLAR_TERMS_PATH } from '../constants/privateCellarTerms';

type Overview = inferRouterOutputs<AppRouter>['onboarding']['member']['overview'];

export interface MembershipSummaryProps {
  overview: Overview;
}

const aed = (value: number) => `AED ${value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

/**
 * The member's plan at a glance: what it costs, what it includes, and — once
 * started — what they hold and what this month comes to
 */
const MembershipSummary = ({ overview }: MembershipSummaryProps) => {
  const api = useTRPC();
  const { membershipStatus, billedByCard, terms, cases, thisMonth } = overview;
  const isActive = membershipStatus === 'active' || membershipStatus === 'past_due';
  const updateCard = useMutation(
    api.onboarding.member.updateCard.mutationOptions({
      onSuccess: ({ url }) => window.location.assign(url),
    }),
  );

  const status =
    membershipStatus === 'past_due'
      ? { label: 'Paused', tone: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-900' }
      : isActive
        ? { label: 'Active', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900' }
        : { label: 'Not started', tone: 'bg-surface-muted text-text-muted ring-border-muted' };

  const tiles = [
    { value: aed(terms.membershipFeeAed), label: 'per month' },
    { value: String(terms.includedCases), label: 'cases included' },
    isActive
      ? { value: cases.toLocaleString('en-GB'), label: 'cases held' }
      : { value: aed(terms.extraCaseMonthlyAed), label: 'per extra case' },
  ];

  return (
    <section className="border-border-muted bg-surface-primary h-fit rounded-xl border p-4 shadow-sm sm:p-5">
      <header className="flex items-center justify-between gap-2">
        <p className="text-text-muted text-[11px] font-semibold uppercase tracking-wider">Membership</p>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${status.tone}`}>
          {status.label}
        </span>
      </header>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-lg border border-slate-200 bg-gradient-to-b from-slate-50/60 to-transparent px-2 py-2.5 text-center dark:border-slate-700 dark:from-slate-500/10"
          >
            <span className="text-text-primary block text-sm font-bold tabular-nums sm:text-base">{tile.value}</span>
            <span className="text-text-muted block text-[10px] leading-tight sm:text-[11px]">{tile.label}</span>
          </div>
        ))}
      </div>

      {isActive ? (
        <div className="border-border-muted mt-4 flex items-baseline justify-between border-t pt-3 text-sm">
          <span className="text-text-muted">
            This month
            {thisMonth.extraCases > 0 && (
              <span className="block text-xs">
                {aed(terms.membershipFeeAed)} + {thisMonth.extraCases} extra × {aed(terms.extraCaseMonthlyAed)}
              </span>
            )}
          </span>
          <span className="text-text-primary text-base font-semibold tabular-nums">{aed(thisMonth.totalAed)}</span>
        </div>
      ) : (
        <p className="text-text-muted mt-4 text-xs leading-5">
          There is nothing to pay until you first buy, release, sell or bring wine in. Storage is counted in 12-bottle
          cases; a 6-bottle case counts as half.
        </p>
      )}

      {membershipStatus === 'past_due' && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50/60 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-500/10 dark:text-red-300">
          {billedByCard
            ? 'Your last payment did not go through. Please update your card.'
            : 'Your membership is paused. Please contact us to settle your membership invoice.'}
          {billedByCard && (
            <button
              type="button"
              onClick={() => updateCard.mutate()}
              disabled={updateCard.isPending}
              className="bg-text-primary text-surface-primary mt-2 block h-9 rounded-lg px-3 text-xs font-semibold"
            >
              Update your card
            </button>
          )}
        </div>
      )}

      <Link
        href={PRIVATE_CELLAR_TERMS_PATH}
        target="_blank"
        className="text-text-muted hover:text-text-primary mt-3 inline-block text-xs underline underline-offset-2"
      >
        Membership terms
      </Link>
    </section>
  );
};

export default MembershipSummary;
