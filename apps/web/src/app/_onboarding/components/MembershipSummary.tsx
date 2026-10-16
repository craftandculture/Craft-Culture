'use client';

import { useMutation } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import Link from 'next/link';

import useTRPC from '@/lib/trpc/browser';
import type { AppRouter } from '@/trpc-router';

import { PRIVATE_CELLAR_TERMS_PATH } from '../constants/privateCellarTerms';
import wineSources from '../constants/wineSources';

type Overview = inferRouterOutputs<AppRouter>['onboarding']['member']['overview'];

export interface MembershipSummaryProps {
  overview: Overview;
}

const count = (value: number) =>
  value.toLocaleString('en-GB', { maximumFractionDigits: 1 });

/**
 * The member's account at a glance: what they hold, how much of their storage
 * it uses, and what is on its way
 *
 * Deliberately not a bill. The fee was agreed when they joined and is on every
 * invoice; showing a running total here invites a member to manage their
 * cellar down to it. What it shows instead is the collection, and the
 * allowance as room to grow into.
 */
const MembershipSummary = ({ overview }: MembershipSummaryProps) => {
  const api = useTRPC();
  const { membershipStatus, billedByCard, terms, cases, bottles, wines, intakes } = overview;
  const isActive = membershipStatus === 'active' || membershipStatus === 'past_due';
  const updateCard = useMutation(
    api.onboarding.member.updateCard.mutationOptions({
      onSuccess: ({ url }) => window.location.assign(url),
    }),
  );

  const incomingCases = intakes
    .filter((intake) => wineSources.find((source) => source.value === intake.source)?.isTransfer)
    .reduce((sum, intake) => sum + (intake.shipment?.cases || intake.approxCases || 0), 0);

  const used = Math.min(100, terms.includedCases > 0 ? (cases / terms.includedCases) * 100 : 0);

  const status =
    membershipStatus === 'past_due'
      ? { label: 'Paused', tone: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-900' }
      : isActive
        ? {
            label: 'Membership active',
            tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900',
          }
        : { label: 'Not started', tone: 'bg-surface-muted text-text-muted ring-border-muted' };

  const tiles = [
    { value: count(wines), label: wines === 1 ? 'wine' : 'wines' },
    { value: count(bottles), label: bottles === 1 ? 'bottle' : 'bottles' },
    { value: count(cases), label: cases === 1 ? 'case stored' : 'cases stored' },
  ];

  return (
    <section className="border-border-muted bg-surface-primary h-fit rounded-xl border p-4 shadow-sm sm:p-5">
      <header className="flex items-center justify-between gap-2">
        <p className="text-text-muted text-[11px] font-semibold uppercase tracking-wider">Your account</p>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${status.tone}`}>
          {status.label}
        </span>
      </header>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-lg border border-emerald-100 bg-gradient-to-b from-emerald-50/60 to-transparent px-2 py-2.5 text-center dark:border-emerald-900/50 dark:from-emerald-500/10"
          >
            <span className="text-text-primary block text-lg font-bold tabular-nums">{tile.value}</span>
            <span className="text-text-muted block text-[10px] leading-tight sm:text-[11px]">{tile.label}</span>
          </div>
        ))}
      </div>

      {/* The allowance as room to grow into, not as a meter running towards a charge */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between text-xs">
          <span className="text-text-muted">Storage included in your membership</span>
          <span className="text-text-primary font-semibold tabular-nums">
            {count(Math.min(cases, terms.includedCases))} of {terms.includedCases} cases
          </span>
        </div>
        <div className="bg-surface-muted h-2 overflow-hidden rounded-full">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${used}%` }} />
        </div>
      </div>

      {incomingCases > 0 && (
        <p className="text-text-muted border-border-muted mt-4 border-t pt-3 text-xs">
          <span className="text-text-primary font-semibold">About {count(incomingCases)} cases</span> on their way to
          your cellar
        </p>
      )}

      {!isActive && (
        <p className="text-text-muted mt-4 text-xs leading-5">
          Your membership begins the first time you buy, sell, request a delivery or bring wine in, and includes
          storage for {terms.includedCases * 12} bottles.
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
