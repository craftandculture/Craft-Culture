'use client';

import { IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import useTRPC from '@/lib/trpc/browser';

import BANNER_STORAGE_KEY from '../constants/bannerStorageKey';
import linkLabelFor from '../utils/linkLabelFor';

/** A feature is announced on Your cellar for this long after it shipped */
const BANNER_DAYS = 21;

/**
 * A quiet one-line note of the latest feature, where the member lands
 *
 * Taken from What's New, so it needs no upkeep: the newest published feature
 * or improvement that points to a screen, for three weeks, and only while the
 * member has not yet seen it. It goes once the member closes it or reads
 * What's New, and the next feature replaces it. A pale tint and a dot, never a
 * dark panel, so it never competes with the wine.
 */
const WhatsNewBanner = () => {
  const api = useTRPC();
  const [done, setDone] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const { data } = useQuery({
    ...api.productUpdates.listForMe.queryOptions(),
    retry: false,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    try {
      setDone(window.localStorage.getItem(BANNER_STORAGE_KEY));
    } catch {
      // Storage refused (private browsing): the banner simply shows
    }
    setReady(true);
  }, []);

  const since = Date.now() - BANNER_DAYS * 86_400_000;
  const latest = data?.enabled
    ? data.updates.find(
        (u) => u.type !== 'fix' && u.linkPath && new Date(u.date).getTime() >= since,
      )
    : undefined;

  // Already read on What's New: nothing new to say
  const seen =
    !!latest &&
    !!data?.seenAt &&
    new Date(latest.date).getTime() <= new Date(data.seenAt).getTime();

  if (!ready || !latest || seen || done === latest.id) return null;

  const close = () => {
    setDone(latest.id);
    try {
      window.localStorage.setItem(BANNER_STORAGE_KEY, latest.id);
    } catch {
      // Hidden for this visit only
    }
  };

  return (
    <section className="mb-4 flex items-center gap-3 rounded-xl bg-emerald-50/70 py-2 pr-1.5 pl-4 dark:bg-emerald-500/10">
      <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
      <p className="text-text-primary min-w-0 flex-1 truncate text-sm">{latest.title}</p>
      {latest.linkPath && (
        <Link
          href={latest.linkPath}
          onClick={close}
          className="shrink-0 px-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
        >
          {linkLabelFor(latest.linkPath) ?? 'View'}
        </Link>
      )}
      <button
        type="button"
        onClick={close}
        aria-label="Dismiss"
        className="text-text-muted hover:text-text-primary grid size-7 shrink-0 place-items-center rounded-full"
      >
        <IconX size={14} />
      </button>
    </section>
  );
};

export default WhatsNewBanner;
