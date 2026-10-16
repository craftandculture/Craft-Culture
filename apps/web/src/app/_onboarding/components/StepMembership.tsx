'use client';

import { IconCheck, IconChevronDown, IconLock } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';

import StepFrame from './StepFrame';
import { PRIVATE_CELLAR_TERMS_PATH } from '../constants/privateCellarTerms';

export interface MembershipTerms {
  membershipFeeAed: number;
  includedCases: number;
  extraCaseMonthlyAed: number;
}

export interface StepMembershipProps {
  terms: MembershipTerms;
  /** Already accepted (a re-visit) — the box starts ticked */
  hasAccepted: boolean;
  /** Invited members' cellars open at once; others are reviewed first */
  opensImmediately: boolean;
  isBusy: boolean;
  onSubmit: () => void;
  onBack: () => void;
}

const formatAed = (value: number) => `AED ${value.toLocaleString('en-GB')}`;

/**
 * Step four: the membership, and opening the cellar
 *
 * Nothing is charged here. Reads as a benefit being opened rather than a
 * tariff being reviewed: the price and what it includes first, "nothing to
 * pay today" said before the figure can worry anyone, and the counting rule
 * folded away for those who want it. The fee starts at the first action, by
 * invoice or card, and the member is told before it does.
 */
const StepMembership = ({ terms, hasAccepted, opensImmediately, isBusy, onSubmit, onBack }: StepMembershipProps) => {
  const [accepted, setAccepted] = useState(hasAccepted);

  const points = [
    `Additional storage ${formatAed(terms.extraCaseMonthlyAed)} per 12-bottle case, or ${formatAed(
      terms.extraCaseMonthlyAed / 2,
    )} per 6-bottle case, a month`,
    "Monthly, cancel with 30 days' notice",
    'VAT where applicable. Wine purchased through C&C is charged separately.',
  ];

  return (
    <StepFrame
      title="Membership"
      intro="Opening your cellar is free. Your membership begins only when you first use your cellar, to add wine, buy, sell or arrange a delivery, and we will confirm with you before it does."
      onContinue={onSubmit}
      onBack={onBack}
      continueLabel={opensImmediately ? 'Open my private cellar' : 'Request my private cellar'}
      isBusy={isBusy}
      isContinueDisabled={!accepted}
    >
      <div className="border-border-muted overflow-hidden rounded-2xl border">
        <div className="bg-surface-secondary/40 flex flex-wrap items-end justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-text-muted text-xs font-semibold tracking-[0.16em] uppercase">Private Cellar</p>
            <p className="text-text-primary mt-1 text-3xl font-semibold tracking-tight tabular-nums">
              {formatAed(terms.membershipFeeAed)}
              <span className="text-text-muted text-base font-medium"> / month</span>
            </p>
            <p className="text-text-muted mt-1 text-sm">
              Includes storage for {terms.includedCases * 12} bottles ({terms.includedCases} cases of 12)
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <IconLock size={13} />
            Nothing to pay today
          </span>
        </div>

        <ul className="divide-border-muted divide-y">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-3 px-5 py-3">
              <IconCheck size={16} stroke={2.5} className="text-text-muted mt-0.5 shrink-0" />
              <span className="text-text-primary text-sm leading-6">{point}</span>
            </li>
          ))}
        </ul>

        <details className="group border-border-muted border-t px-5 py-3">
          <summary className="text-text-muted flex cursor-pointer list-none items-center justify-between text-xs font-medium">
            How storage is counted
            <IconChevronDown size={14} className="transition-transform group-open:rotate-180" />
          </summary>
          <p className="text-text-muted mt-2 text-xs leading-5">
            By case equivalent: one sealed 12-bottle case, or every 12 loose bottles, counts as one case. A 6-bottle
            case counts as half a case, loose bottles are rounded up to the next six, and a magnum counts as two
            bottles.
          </p>
        </details>
      </div>

      <button
        type="button"
        onClick={() => setAccepted((value) => !value)}
        aria-pressed={accepted}
        className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
          accepted ? 'border-text-primary' : 'border-border-primary'
        }`}
      >
        <span
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border ${
            accepted ? 'border-text-primary bg-text-primary text-surface-primary' : 'border-border-primary'
          }`}
        >
          {accepted && <IconCheck size={14} stroke={3} />}
        </span>
        <span className="text-text-primary text-sm leading-6">
          I have read and agree to the{' '}
          <Link
            href={PRIVATE_CELLAR_TERMS_PATH}
            target="_blank"
            className="text-text-primary underline underline-offset-2"
            onClick={(event) => event.stopPropagation()}
          >
            Private Cellar Terms
          </Link>
          .
        </span>
      </button>
    </StepFrame>
  );
};

export default StepMembership;
