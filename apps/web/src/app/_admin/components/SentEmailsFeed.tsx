'use client';

import { IconSearch } from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import useTRPC from '@/lib/trpc/browser';

type Filter = 'all' | 'people' | 'team' | 'failed';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'people', label: 'To people' },
  { key: 'team', label: 'Team copies' },
  { key: 'failed', label: 'Failed' },
];

const when = (value: Date | string) =>
  new Date(value).toLocaleString('en-GB', {
    timeZone: 'Asia/Dubai',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Sent Emails: every email the app has handed to Loops, newest first
 *
 * For checking a release: who each email went to, what it said and whether
 * Loops took it. Shadow copies are shown with the person they were written
 * for, so the team can tell a copy from an email that reached someone.
 */
const SentEmailsFeed = () => {
  const api = useTRPC();
  const [filter, setFilter] = useState<Filter>('all');
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed.trim()), 300);
    return () => clearTimeout(timer);
  }, [typed]);

  const { data, isLoading, isFetching } = useQuery({
    ...api.admin.emailLog.queryOptions({ filter, search: search || undefined }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  const counts = data?.counts;
  const tiles: { label: string; value: number | undefined; tint: string; pick?: Filter }[] = [
    { label: 'Sent to people', value: counts?.people, tint: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200', pick: 'people' },
    { label: 'Team copies', value: counts?.team, tint: 'bg-sky-50 text-sky-900 dark:bg-sky-500/10 dark:text-sky-200', pick: 'team' },
    { label: 'Failed', value: counts?.failed, tint: 'bg-red-50 text-red-900 dark:bg-red-500/10 dark:text-red-200', pick: 'failed' },
    { label: 'Held back (switch off)', value: counts?.held, tint: 'bg-fill-muted text-text-primary' },
  ];

  return (
    <div className="pb-10">
      <header className="mb-5">
        <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Sent Emails</h1>
        <p className="text-text-muted mt-0.5 max-w-2xl text-sm">
          Every email the Index sends, as it leaves: members, partners, distributors, clients and the team. Counts
          cover the last seven days.
        </p>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <button
            key={tile.label}
            type="button"
            disabled={!tile.pick}
            onClick={() => tile.pick && setFilter(filter === tile.pick ? 'all' : tile.pick)}
            className={`rounded-xl p-4 text-left transition-shadow enabled:hover:shadow-sm ${tile.tint} ${
              tile.pick && filter === tile.pick ? 'ring-text-primary ring-2' : ''
            }`}
          >
            <span className="block text-2xl font-semibold tabular-nums">{tile.value ?? '–'}</span>
            <span className="text-sm">{tile.label}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <IconSearch className="text-text-muted absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Search address, name, subject or order number"
            className="border-border-muted bg-surface-primary text-text-primary placeholder:text-text-muted focus:border-text-primary h-10 w-full rounded-xl border pl-9 pr-3 text-sm focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                filter === option.key ? 'bg-text-primary text-surface-primary' : 'text-text-muted hover:bg-fill-muted'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <section className="border-border-muted bg-surface-primary overflow-hidden rounded-xl border">
        {isLoading ? (
          <p className="text-text-muted px-4 py-12 text-center text-sm">Loading…</p>
        ) : data && !data.ready ? (
          <p className="text-text-muted px-4 py-12 text-center text-sm">
            The feed starts with the next release. Emails sent from then on appear here.
          </p>
        ) : !data?.rows.length ? (
          <p className="text-text-muted px-4 py-12 text-center text-sm">
            {search || filter !== 'all' ? 'No emails match.' : 'No emails sent yet.'}
          </p>
        ) : (
          <ul className={`divide-text-muted/25 divide-y transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
            {data.rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary truncate text-sm font-semibold">{row.subject || row.template}</p>
                  <p className="text-text-muted truncate text-xs">
                    {row.shadowFor ? (
                      <>
                        Copy for <span className="text-text-primary">{row.shadowFor}</span> · went to {row.toEmail}
                      </>
                    ) : (
                      <>
                        To <span className="text-text-primary">{row.toEmail}</span>
                      </>
                    )}
                    {' · '}
                    {row.template}
                    {row.reference ? ` · ${row.reference}` : ''}
                  </p>
                  {row.error && <p className="truncate text-xs text-red-700 dark:text-red-400">{row.error}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-text-muted text-xs tabular-nums">{when(row.createdAt)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      !row.ok
                        ? 'bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300'
                        : row.toTeam
                          ? 'bg-sky-50 text-sky-800 dark:bg-sky-500/10 dark:text-sky-300'
                          : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
                    }`}
                  >
                    {!row.ok ? 'Failed' : row.toTeam ? 'Team' : 'Sent'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default SentEmailsFeed;
