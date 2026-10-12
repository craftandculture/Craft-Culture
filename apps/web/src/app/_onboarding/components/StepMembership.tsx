'use client';

import { IconCheck } from '@tabler/icons-react';
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
const StepMembership = ({ terms, hasAccepted, isBusy, onSubmit, onBack }: StepMembershipProps) => {
  const [accepted, setAccepted] = useState(hasAccepted);

  const rows = [
    ['Membership', `${formatAed(terms.membershipFeeAed)} a month`],
    ['Included', `Storage for up to ${terms.includedCases} cases`],
    ['Above that', `${formatAed(terms.extraCaseMonthlyAed)} per case, per month`],
    ['VAT', 'None — held in a free zone bond'],
    ['Commitment', "Monthly, with 30 days' notice"],
  ];

  return (
    <StepFrame
      title="Membership"
      intro="Joining is free. Your membership starts the first time you buy, release, sell or bring wine into your cellar — we'll ask for a card then, not now."
      onContinue={onSubmit}
      onBack={onBack}
      continueLabel="Submit"
      isBusy={isBusy}
      isContinueDisabled={!accepted}
    >
      <dl className="border-border-muted divide-border-muted divide-y rounded-xl border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="text-text-muted text-sm">{label}</dt>
            <dd className="text-text-primary text-right text-sm font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-text-muted text-xs leading-5">
        A case is counted as a sealed case, or every six loose bottles (a magnum counts as two).
        Wine you buy in bond is paid for separately, by bank transfer.
      </p>

      <button
        type="button"
        onClick={() => setAccepted((value) => !value)}
        aria-pressed={accepted}
        className="flex w-full items-start gap-3 text-left"
      >
        <span
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border ${
            accepted ? 'border-border-brand bg-fill-brand text-text-brand-on-fill' : 'border-border-primary'
          }`}
        >
          {accepted && <IconCheck size={14} stroke={3} />}
        </span>
        <span className="text-text-primary text-sm leading-6">
          I accept the{' '}
          <Link
            href={PRIVATE_CELLAR_TERMS_PATH}
            target="_blank"
            className="text-text-brand underline underline-offset-2"
            onClick={(event) => event.stopPropagation()}
          >
            Private Cellar membership terms
          </Link>
          .
        </span>
      </button>
    </StepFrame>
  );
};

export default StepMembership;
