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
 * "New in your private cellar": the latest feature, announced where the
 * member lands
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
    <section className="relative mb-5 overflow-hidden rounded-2xl bg-neutral-950 px-5 py-5 text-white sm:px-7 sm:py-6 dark:border dark:border-emerald-500/20 dark:bg-emerald-950/40">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-10 size-64 rounded-full bg-emerald-500/20 blur-3xl"
      />
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="absolute top-3 right-3 grid size-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
      >
        <IconX size={16} />
      </button>
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="min-w-0 pr-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-white/80 uppercase">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            New in your private cellar
          </span>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-balance sm:text-2xl">{latest.title}</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-white/70">{latest.body}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {latest.linkPath && (
            <Link
              href={latest.linkPath}
              onClick={close}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-5 text-sm font-semibold text-neutral-950 hover:bg-emerald-50"
            >
              {linkLabelFor(latest.linkPath)}
              <IconArrowRight size={16} />
            </Link>
          )}
          <Link
            href="/platform/cellar/whats-new"
            className="text-sm font-semibold text-white/70 underline-offset-4 hover:text-white hover:underline"
          >
            All updates
          </Link>
        </div>
      </div>
    </section>
  );
};

export default WhatsNewBanner;
