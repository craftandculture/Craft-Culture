'use client';

import { IconArrowRight, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import useTRPC from '@/lib/trpc/browser';

import BANNER_STORAGE_KEY from '../constants/bannerStorageKey';
import linkLabelFor from '../utils/linkLabelFor';

/** A feature is announced on Your cellar for this long after it shipped */
const BANNER_DAYS = 21;

/**
 * A one-line note of the latest feature, where the member lands
 *
 * Taken from What's New, so it needs no upkeep: the newest published feature
 * or improvement that points to a screen, for three weeks. It goes once the
 * member closes it or reads What's New, and the next feature replaces it.
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

  if (!ready || !latest || done === latest.id) return null;

  const close = () => {
    setDone(latest.id);
    try {
      window.localStorage.setItem(BANNER_STORAGE_KEY, latest.id);
    } catch {
      // Hidden for this visit only
    }
  };

  return (
    <section className="mb-4 flex items-center gap-3 rounded-xl bg-neutral-950 py-2.5 pr-2 pl-4 text-white dark:border dark:border-emerald-500/20 dark:bg-emerald-950/40">
      <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-sm">
        <span className="font-semibold text-emerald-300">New</span>
        <span className="mx-2 text-white/30">·</span>
        <span className="font-medium">{latest.title}</span>
      </p>
      {latest.linkPath && (
        <Link
          href={latest.linkPath}
          onClick={close}
          className="hidden shrink-0 items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/20 sm:inline-flex"
        >
          {linkLabelFor(latest.linkPath)}
          <IconArrowRight size={13} />
        </Link>
      )}
      <Link
        href="/platform/cellar/whats-new"
        className="shrink-0 px-1 text-xs font-semibold text-white/60 hover:text-white"
      >
        All updates
      </Link>
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="grid size-7 shrink-0 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
      >
        <IconX size={14} />
      </button>
    </section>
  );
};

export default WhatsNewBanner;
