'use client';

import { IconArrowRight, IconBrandWhatsapp, IconCheck } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import useTRPC from '@/lib/trpc/browser';

import BringWineIn from './BringWineIn';
import intakeStages from '../constants/intakeStages';
import wineSources from '../constants/wineSources';

const aed = (value: number) => `AED ${value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

/**
 * The top of a member's cellar: what to finish, what is coming in, and what
 * the month costs
 *
 * Shows only what applies — a member with a complete profile, nothing in
 * transit and an active membership sees one quiet line. Nothing here blocks
 * looking around; the ID is asked for again when they first act.
 */
const CellarOverviewPanel = () => {
  const api = useTRPC();
  const { data, refetch } = useQuery(api.onboarding.member.overview.queryOptions());
  const updateCard = useMutation(
    api.onboarding.member.updateCard.mutationOptions({
      onSuccess: ({ url }) => {
        window.location.assign(url);
      },
    }),
  );

  if (!data) return null;

  const { missing, intakes, membershipStatus, billedByCard, terms, cases, thisMonth } = data;
  const isActive = membershipStatus === 'active' || membershipStatus === 'past_due';

  return (
    <div className="mb-5 grid gap-3 lg:grid-cols-2">
      {missing.length > 0 && (
        <div className="border-border-muted bg-surface-primary rounded-xl border p-4 shadow-sm">
          <p className="text-text-primary text-sm font-semibold">Finish setting up</p>
          <p className="text-text-muted mt-1 text-xs leading-5">
            {missing.includes('Emirates ID')
              ? 'Add your Emirates ID to start buying, releasing and bringing wine in.'
              : 'A couple of details so deliveries go smoothly.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missing.map((item) => (
              <Link
                key={item}
                href="/platform/cellar/profile"
                className="border-border-muted bg-surface-primary text-text-primary inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm"
              >
                Add {item.toLowerCase()} <IconArrowRight size={12} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {intakes.map((intake) => {
        const at = intakeStages.findIndex((stage) => stage.value === intake.stage);
        const source = wineSources.find((item) => item.value === intake.source);
        return (
          <div key={intake.id} className="border-border-muted bg-surface-primary rounded-xl border p-4 shadow-sm">
            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-wider">Incoming</p>
            <p className="text-text-primary mt-1 text-sm font-semibold">
              {intake.holderName && intake.source !== 'lcb' ? intake.holderName : source?.label}
              {intake.approxCases ? ` · about ${intake.approxCases} cases` : ''}
            </p>
            <ol className="mt-3 space-y-1.5">
              {intakeStages.map((stage, index) => (
                <li key={stage.value} className="flex items-center gap-2 text-xs">
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded-full ${
                      index <= at ? 'bg-emerald-500 text-white' : 'border-border-muted border'
                    }`}
                  >
                    {index <= at && <IconCheck size={10} stroke={3} />}
                  </span>
                  <span className={index === at ? 'text-text-primary font-semibold' : 'text-text-muted'}>
                    {stage.label}
                  </span>
                </li>
              ))}
            </ol>
            <a
              href={`https://wa.me/971581498156?text=${encodeURIComponent(`Hello, a question about my wine coming in from ${intake.holderName ?? source?.label ?? 'my cellar'}.`)}`}
              target="_blank"
              rel="noreferrer"
              className="text-text-primary mt-3 inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2"
            >
              <IconBrandWhatsapp size={14} /> Ask about this
            </a>
          </div>
        );
      })}

      <div className="border-border-muted bg-surface-primary rounded-xl border p-4 shadow-sm">
        <p className="text-text-muted text-[11px] font-semibold uppercase tracking-wider">
          {isActive ? 'This month' : 'Membership'}
        </p>
        {isActive ? (
          <p className="text-text-primary mt-1 text-sm tabular-nums">
            {cases} {cases === 1 ? 'case' : 'cases'} of 12 → {aed(terms.membershipFeeAed)}
            {thisMonth.extraCases > 0 && ` + ${thisMonth.extraCases} × ${aed(terms.extraCaseMonthlyAed)}`} ={' '}
            <span className="font-semibold">{aed(thisMonth.totalAed)}</span>
          </p>
        ) : (
          <p className="text-text-primary mt-1 text-sm leading-6">
            Free until you first buy, release, sell or bring wine in. Then {aed(terms.membershipFeeAed)} a month for
            up to {terms.includedCases} cases of 12 (a 6-bottle case counts as half), then{' '}
            {aed(terms.extraCaseMonthlyAed)} per 12-bottle case and {aed(terms.extraCaseMonthlyAed / 2)} per 6-bottle
            case. No VAT.
          </p>
        )}
        {membershipStatus === 'past_due' && (
          <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
            {billedByCard
              ? 'Your last payment did not go through — please update your card.'
              : 'Your membership is paused. Please contact us to settle your membership invoice.'}
          </p>
        )}
        {membershipStatus === 'past_due' && billedByCard && (
          <button
            type="button"
            onClick={() => updateCard.mutate()}
            disabled={updateCard.isPending}
            className="bg-text-primary text-surface-primary mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold"
          >
            Update your card
          </button>
        )}
      </div>

      <BringWineIn onAdded={() => void refetch()} />
    </div>
  );
};

export default CellarOverviewPanel;
