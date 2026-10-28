'use client';

import { IconRefresh } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import MobileCard from '@/app/_ui/components/MobileCard/MobileCard';
import MobileCardList from '@/app/_ui/components/MobileCard/MobileCardList';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import ZohoCustomerLink from './admin/ZohoCustomerLink';

type Filter = 'all' | 'waiting' | 'overage' | 'dormant';

const money = (value: number) =>
  `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const membershipLabel: Record<string, string> = {
  not_activated: 'Not activated',
  pending_payment: 'Awaiting card',
  active: 'Membership active',
  past_due: 'Payment failed',
  cancelled: 'Cancelled',
};

const membershipPill: Record<string, string> = {
  not_activated: 'bg-slate-50 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300',
  pending_payment: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  past_due: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300',
  cancelled: 'bg-slate-50 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300',
};

const since = (value: string | Date | null) =>
  value ? formatDistanceToNowStrict(new Date(value), { addSuffix: true }) : '';

/**
 * The cellar membership, one row per member
 *
 * Sorted by who is waiting on us, oldest first, so working down the screen is
 * working the queue. The rest of the row answers the question that follows
 * once a name has your attention: how much is in there, what it is worth, and
 * whether they are past the twenty cases the membership includes.
 */
const CellarMembersList = () => {
  const api = useTRPC();
  const [filter, setFilter] = useState<Filter>('all');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    ...api.cellar.admin.getMembers.queryOptions(),
  });

  const members = data?.members ?? [];
  const includedCases = data?.includedCases ?? 20;

  /*
    Dormant is defined by no stock and nothing pending rather than by a date.
    A member whose wine has sat untouched for a year is not dormant — that is
    what bonded storage is for.
  */
  /*
    One test per filter, used for both the list and the count on its chip. The
    counts were worked out separately and drifted: Waiting on us added up
    requests while the list showed members, so the chip said 5 above 2 rows.
  */
  const matches = (member: (typeof members)[number], id: Filter) => {
    if (id === 'waiting') return member.waitingOnUs > 0;
    if (id === 'overage') return member.overageCases > 0;
    if (id === 'dormant')
      return (
        member.bottles === 0 &&
        member.waitingOnUs === 0 &&
        member.waitingOnThem === 0
      );
    return true;
  };

  const shown = members.filter((member) => matches(member, filter));

  const totals = members.reduce(
    (sum, member) => ({
      bottles: sum.bottles + member.bottles,
      cases: sum.cases + member.cases,
      value: sum.value + member.valueUsd,
      overage: sum.overage + member.overageCases,
    }),
    { bottles: 0, cases: 0, value: 0, overage: 0 },
  );

  const filters = (
    [
      { id: 'all', label: 'All members' },
      { id: 'waiting', label: 'Waiting on us' },
      { id: 'overage', label: 'Over allowance' },
      { id: 'dormant', label: 'Nothing held' },
    ] satisfies { id: Filter; label: string }[]
  ).map((item) => ({
    ...item,
    count: members.filter((member) => matches(member, item.id)).length,
  }));

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Typography variant="bodySm" colorRole="muted">
          What each member holds, and what they are waiting on
        </Typography>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          isDisabled={isRefetching}
        >
          <ButtonContent iconLeft={IconRefresh}>Refresh</ButtonContent>
        </Button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Members', value: members.length.toLocaleString() },
          { label: 'Bottles held', value: totals.bottles.toLocaleString() },
          { label: 'Value on import', value: money(totals.value) },
          {
            label: 'Cases over allowance',
            value: totals.overage.toLocaleString(),
          },
        ].map((card) => (
          <div
            key={card.label}
            className="border-border-muted rounded-xl border px-4 py-3"
          >
            <Typography variant="bodyXs" colorRole="muted" className="block">
              {card.label}
            </Typography>
            <Typography variant="headingSm" className="mt-0.5 block tabular-nums">
              {card.value}
            </Typography>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === item.id
                ? 'bg-text-primary text-surface-primary'
                : 'border-border-muted text-text-muted hover:text-text-primary border'
            }`}
          >
            {item.label}
            {item.count > 0 && (
              <span className="ml-1.5 tabular-nums opacity-70">
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading && (
        <Typography variant="bodySm" colorRole="muted">
          Loading members...
        </Typography>
      )}

      {!isLoading && shown.length === 0 && (
        <div className="border-border-muted rounded-xl border px-6 py-12 text-center">
          <Typography variant="bodyMd" colorRole="muted">
            {members.length === 0
              ? 'No active members yet.'
              : 'Nothing matches that filter.'}
          </Typography>
        </div>
      )}

      {!isLoading && shown.length > 0 && (
        <>
        <div className="border-border-muted hidden overflow-x-auto rounded-xl border md:block">
          <table className="w-full min-w-[780px] text-sm">
            <thead>
              <tr className="text-text-muted border-border-muted border-b text-[11px] uppercase tracking-wider">
                <th className="px-4 py-2 text-left">Member</th>
                <th className="px-3 py-2 text-right">Wines</th>
                <th className="px-3 py-2 text-right">Cases</th>
                <th className="px-3 py-2 text-right">Bottles</th>
                <th className="px-3 py-2 text-right">Value</th>
                <th className="px-3 py-2 text-right">Over {includedCases}</th>
                <th className="px-3 py-2 text-left">Waiting</th>
                <th className="px-3 py-2 text-right">Last movement</th>
                <th className="px-4 py-2 text-right">Zoho</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((member) => (
                <tr
                  key={member.id}
                  className="border-border-muted hover:bg-fill-muted/40 border-b transition-colors last:border-b-0"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/platform/admin/cellar-statements?member=${member.id}`}
                      className="hover:underline"
                      title="Open this member's statement"
                    >
                      <Typography variant="bodySm" className="font-semibold">
                        {member.name}
                      </Typography>
                    </Link>
                    {member.code && (
                      <span className="text-text-muted mr-1.5 font-mono text-[11px]">
                        {member.code}
                      </span>
                    )}
                    {member.membershipStatus && (
                      <span
                        className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                          membershipPill[member.membershipStatus] ?? membershipPill.not_activated
                        }`}
                      >
                        {membershipLabel[member.membershipStatus] ?? member.membershipStatus}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {member.wines || ''}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {member.cases || ''}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {member.bottles || ''}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {member.valueUsd ? money(member.valueUsd) : ''}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {member.overageCases > 0 ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                        {member.overageCases}
                      </span>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {member.waitingOnUs > 0 ? (
                      <Link
                        href="/platform/admin/cellar-releases"
                        className="text-text-primary underline-offset-2 text-xs font-semibold hover:underline"
                      >
                        {member.waitingOnUs} to quote
                        {member.oldestSubmittedAt && (
                          <span className="text-text-muted ml-1 font-normal">
                            · {since(member.oldestSubmittedAt)}
                          </span>
                        )}
                      </Link>
                    ) : member.waitingOnThem > 0 ? (
                      <span className="text-text-muted text-xs">
                        {member.waitingOnThem} with them
                      </span>
                    ) : (
                      <span className="text-text-muted text-xs" />
                    )}
                  </td>
                  <td className="text-text-muted px-3 py-2.5 text-right text-xs">
                    {since(member.lastMovementAt)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <ZohoCustomerLink
                      partnerId={member.id}
                      memberName={member.name}
                      zohoContactId={member.zohoContactId}
                      onLinked={() => void refetch()}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* One card per member on a phone */}
        <MobileCardList>
          {shown.map((member) => (
            <MobileCard
              key={member.id}
              title={member.name}
              aside={
                member.membershipStatus ? (
                  <span
                    className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                      membershipPill[member.membershipStatus] ?? membershipPill.not_activated
                    }`}
                  >
                    {membershipLabel[member.membershipStatus] ?? member.membershipStatus}
                  </span>
                ) : null
              }
              meta={[member.code, `last movement ${since(member.lastMovementAt)}`].filter(Boolean).join(' · ')}
              fields={[
                { label: 'Cases', value: member.cases || '' },
                { label: 'Bottles', value: member.bottles || '' },
                { label: 'Value', value: member.valueUsd ? money(member.valueUsd) : '' },
                { label: `Over ${includedCases}`, value: member.overageCases > 0 ? member.overageCases : '' },
              ]}
            >
              <div className="flex flex-wrap items-center gap-2">
                {member.waitingOnUs > 0 ? (
                  <Link
                    href="/platform/admin/cellar-releases"
                    className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"
                  >
                    {member.waitingOnUs} to quote
                    {member.oldestSubmittedAt ? ` · ${since(member.oldestSubmittedAt)}` : ''}
                  </Link>
                ) : member.waitingOnThem > 0 ? (
                  <span className="text-text-muted text-xs">{member.waitingOnThem} with them</span>
                ) : null}
                <ZohoCustomerLink
                  partnerId={member.id}
                  memberName={member.name}
                  zohoContactId={member.zohoContactId}
                  onLinked={() => void refetch()}
                />
              </div>
            </MobileCard>
          ))}
        </MobileCardList>
        </>
      )}

      <Typography variant="bodyXs" colorRole="muted" className="mt-3 block">
        Value is what the wine cost on import, not what it is worth today; the
        platform does not price a member&rsquo;s collection.
      </Typography>
    </div>
  );
};

export default CellarMembersList;
