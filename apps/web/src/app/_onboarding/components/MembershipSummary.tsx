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
 * The member's private cellar at a glance: what they hold, how much of their storage
 * it uses, and what is on its way
 *
 * Deliberately not a bill. The fee was agreed when they joined and is on every
 * invoice; showing a running total here invites a member to manage their
 * cellar down to it. What it shows instead is the collection, and the
 * allowance as room to grow into.
 */
const MembershipSummary = ({ overview }: MembershipSummaryProps) => {
  const api = useTRPC();
  const { membershipStatus, billedByCard, includedCases, cases, ukCases, intakes } = overview;
  const ukOnly = cases === 0 && ukCases > 0;
  const isActive = membershipStatus === 'active' || membershipStatus === 'past_due';
  const updateCard = useMutation(
    api.onboarding.member.updateCard.mutationOptions({
      onSuccess: ({ url }) => window.location.assign(url),
    }),
  );

  // Only transfers still on their way; wine already in the cellar is counted above
  const incomingCases = intakes
    .filter(
      (intake) =>
        wineSources.find((source) => source.value === intake.source)?.isTransfer &&
        intake.stage !== 'in_cellar' &&
        intake.stage !== 'closed',
    )
    .reduce((sum, intake) => sum + (intake.shipment?.cases || intake.approxCases || 0), 0);

  const used = Math.min(100, includedCases > 0 ? (cases / includedCases) * 100 : 0);

  const status =
    membershipStatus === 'past_due'
      ? { label: 'Paused', tone: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-900' }
      : isActive
        ? {
            label: 'Membership active',
            tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900',
          }
        : { label: 'Not yet active', tone: 'bg-surface-muted text-text-muted ring-border-muted' };

  const beyond = Math.max(0, cases - includedCases);

  return (
    <section className="border-border-muted bg-surface-primary h-fit rounded-xl border p-4 shadow-sm sm:p-5">
      <header className="flex items-center justify-between gap-2">
        <p className="text-text-muted text-[11px] font-semibold uppercase tracking-wider">Your private cellar</p>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${status.tone}`}>
          {status.label}
        </span>
      </header>

      {/*
        Bottles and wines are already the first thing on the page, so this
        card does not repeat them. It answers the membership question: how
        much storage is held, and where. The allowance applies to the UAE
        only; wine in the UK is held under its own arrangement, so it is
        shown beside it rather than counted against it.
      */}
      <dl className="border-border-muted mt-3 divide-y divide-border-muted rounded-lg border">
        {!ukOnly && (
          <div className="px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-text-muted text-xs">United Arab Emirates</dt>
              <dd className="text-text-primary text-sm">
                <span className="text-lg font-bold tabular-nums">{count(cases)}</span>{' '}
                <span className="text-text-muted text-xs">of {includedCases} included</span>
              </dd>
            </div>
            {/* The allowance as room to grow into, not as a meter running towards a charge */}
            <div className="bg-surface-muted mt-2 h-1.5 overflow-hidden rounded-full">
              {/* Beyond the allowance, the bar shows how much of the store is included rather than running off the end */}
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${beyond > 0 ? (includedCases / cases) * 100 : used}%` }}
              />
            </div>
            {beyond > 0 && (
              <p className="text-text-muted mt-1.5 text-[11px]">
                {count(beyond)} {beyond === 1 ? 'case is' : 'cases are'} stored beyond those included.
              </p>
            )}
          </div>
        )}
        {ukCases > 0 && (
          <div className="px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-text-muted text-xs">United Kingdom · in bond</dt>
              <dd className="text-text-primary text-sm">
                <span className="text-lg font-bold tabular-nums">{count(ukCases)}</span>{' '}
                <span className="text-text-muted text-xs">{ukCases === 1 ? 'case' : 'cases'}</span>
              </dd>
            </div>
            <p className="text-text-muted mt-1 text-[11px]">
              Held under our UK arrangement{ukOnly ? `; your ${includedCases} included cases apply once wine is in the UAE` : ''}.
            </p>
          </div>
        )}
      </dl>
      <p className="text-text-muted mt-1.5 text-[11px]">A case is twelve 75cl bottles; a case of six counts as half.</p>

      {incomingCases > 0 && (
        <p className="text-text-muted border-border-muted mt-4 border-t pt-3 text-xs">
          <span className="text-text-primary font-semibold">About {count(incomingCases)} cases</span> on their way to
          your cellar
        </p>
      )}

      {!isActive && (
        <p className="text-text-muted mt-4 text-xs leading-5">
          Your membership begins the first time you buy, sell, request a delivery or bring wine in. It includes
          storage for {includedCases} cases.
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
