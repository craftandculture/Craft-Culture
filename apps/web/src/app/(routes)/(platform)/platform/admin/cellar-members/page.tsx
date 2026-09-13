'use client';

import { IconRefresh } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

type Filter = 'all' | 'waiting' | 'overage' | 'dormant';

const money = (value: number) =>
  `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const since = (value: string | Date | null) =>
  value ? formatDistanceToNowStrict(new Date(value), { addSuffix: true }) : '—';

/**
 * The cellar membership, one row per member
 *
 * Sorted by who is waiting on us, oldest first, so working down the screen is
 * working the queue. The rest of the row answers the question that follows
 * once a name has your attention: how much is in there, what it is worth, and
 * whether they are past the twenty cases the membership includes.
 */
const CellarMembersPage = () => {
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
  const shown = members.filter((member) => {
    if (filter === 'waiting') return member.waitingOnUs > 0;
    if (filter === 'overage') return member.overageCases > 0;
    if (filter === 'dormant')
      return (
        member.bottles === 0 &&
        member.waitingOnUs === 0 &&
        member.waitingOnThem === 0
      );
    return true;
  });

  const totals = members.reduce(
    (sum, member) => ({
      bottles: sum.bottles + member.bottles,
      cases: sum.cases + member.cases,
      value: sum.value + member.valueUsd,
      waiting: sum.waiting + member.waitingOnUs,
      overage: sum.overage + member.overageCases,
    }),
    { bottles: 0, cases: 0, value: 0, waiting: 0, overage: 0 },
  );

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All members', count: members.length },
    { id: 'waiting', label: 'Waiting on us', count: totals.waiting },
    {
      id: 'overage',
      label: 'Over allowance',
      count: members.filter((member) => member.overageCases > 0).length,
    },
    {
      id: 'dormant',
      label: 'Nothing held',
      count: members.filter((member) => member.bottles === 0).length,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Typography variant="headingLg">Cellar members</Typography>
          <Typography variant="bodySm" colorRole="muted" className="mt-1 block">
            What each member holds, and what they are waiting on
          </Typography>
        </div>
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
                ? 'bg-fill-brand text-text-on-brand'
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
        <div className="border-border-muted overflow-x-auto rounded-xl border">
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
                <th className="px-4 py-2 text-right">Last movement</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((member) => (
                <tr
                  key={member.id}
                  className="border-border-muted hover:bg-fill-muted/40 border-b transition-colors last:border-b-0"
                >
                  <td className="px-4 py-2.5">
                    <Typography variant="bodySm" className="font-semibold">
                      {member.name}
                    </Typography>
                    {member.type === 'wine_partner' && (
                      <Typography
                        variant="bodyXs"
                        colorRole="muted"
                        className="block"
                      >
                        Wine partner
                      </Typography>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {member.wines || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {member.cases || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {member.bottles || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {member.valueUsd ? money(member.valueUsd) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {member.overageCases > 0 ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                        {member.overageCases}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {member.waitingOnUs > 0 ? (
                      <Link
                        href="/platform/admin/cellar-releases"
                        className="text-text-brand text-xs font-semibold hover:underline"
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
                      <span className="text-text-muted text-xs">—</span>
                    )}
                  </td>
                  <td className="text-text-muted px-4 py-2.5 text-right text-xs">
                    {since(member.lastMovementAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Typography variant="bodyXs" colorRole="muted" className="mt-3 block">
        Value is what the wine cost on import, not what it is worth today — the
        platform does not price a member&rsquo;s collection.
      </Typography>
    </div>
  );
};

export default CellarMembersPage;
