'use client';

import { IconCheck, IconLock } from '@tabler/icons-react';
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
 * Step four: the membership terms, and submit
 *
 * Nothing is charged here. The card is asked for the first time the member
 * acts on their cellar, and the monthly fee starts then — said plainly, so
 * nobody submits thinking they have just been billed.
 */
const StepMembership = ({ terms, hasAccepted, opensImmediately, isBusy, onSubmit, onBack }: StepMembershipProps) => {
  const [accepted, setAccepted] = useState(hasAccepted);

  const rows: [string, string[]][] = [
    ['Membership', [`${formatAed(terms.membershipFeeAed)} / month`]],
    ['Storage included', [`Up to ${terms.includedCases} × 12-bottle cases`]],
    [
      'Additional storage',
      [
        `${formatAed(terms.extraCaseMonthlyAed)} / 12-bottle case / month`,
        `${formatAed(terms.extraCaseMonthlyAed / 2)} / 6-bottle case / month`,
      ],
    ],
    ['Commitment', ["Monthly, cancel with 30 days' notice"]],
    ['VAT', ['Where applicable']],
  ];

  return (
    <StepFrame
      title="Membership"
      intro={`There is no charge to open your cellar today. Your ${formatAed(terms.membershipFeeAed)} monthly membership only begins when you first use your cellar, whether you add wine, make a purchase, sell, or arrange a delivery. We will confirm with you before your membership starts.`}
      onContinue={onSubmit}
      onBack={onBack}
      continueLabel={opensImmediately ? 'Open my private cellar' : 'Request my private cellar'}
      isBusy={isBusy}
      isContinueDisabled={!accepted}
    >
      <dl className="border-border-muted divide-border-muted divide-y rounded-xl border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="text-text-muted text-sm">{label}</dt>
            <dd className="text-text-primary text-right text-sm font-semibold">
              {value.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>

      <div className="text-text-muted space-y-2 text-xs leading-5">
        <p>
          Storage is calculated by case equivalent: one sealed 12-bottle case, or every 12 loose bottles, counts as one
          case. A 6-bottle case counts as half a case, loose bottles are rounded up to the next six, and a magnum counts
          as two bottles.
        </p>
        <p>Wine purchased through C&amp;C is charged separately.</p>
      </div>

      <button
        type="button"
        onClick={() => setAccepted((value) => !value)}
        aria-pressed={accepted}
        className="flex w-full items-start gap-3 text-left"
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
            className="text-text-primary underline-offset-2 underline underline-offset-2"
            onClick={(event) => event.stopPropagation()}
          >
            Private Cellar Terms
          </Link>
          .
        </span>
      </button>

      <p className="text-text-primary flex items-center gap-2 text-sm font-medium">
        <IconLock size={16} className="text-text-muted shrink-0" />
        Nothing to pay today.
      </p>
    </StepFrame>
  );
};

export default StepMembership;
