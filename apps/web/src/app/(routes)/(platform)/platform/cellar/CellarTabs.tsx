'use client';

import {
  IconBottle,
  IconFileInvoice,
  IconFileText,
  IconHistory,
  IconShoppingBag,
  IconSparkles,
  IconStars,
  IconTag,
  IconTruckDelivery,
  IconUserCircle,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import accessLevels from '@/app/_cellar/constants/accessLevels';
import useIsCellarViewer from '@/app/_cellar/hooks/useIsCellarViewer';
import useWhatsNewDot from '@/app/_productUpdates/hooks/useWhatsNewDot';
import Icon from '@/app/_ui/components/Icon/Icon';
import useTRPC from '@/lib/trpc/browser';

import CellarPhoneTabs from './CellarPhoneTabs';

/**
 * The places a member works in: their wine, buying more, getting it home and
 * selling it. The same four, in the same order, as the phone's bottom bar.
 */
const coreTabs = [
  { href: '/platform/cellar', label: 'Your cellar', icon: IconBottle },
  /*
    "The pool" was our word for it, not a member's. What they want to know is
    what they can add to their cellar today, so the tab says that. The name is
    "C&C Cellar List"; the phone's bottom bar has room only for "C&C List".
  */
  {
    href: '/platform/cellar/available',
    label: 'C&C Cellar List',
    icon: IconSparkles,
  },
  {
    href: '/platform/cellar/deliveries',
    label: 'Deliveries',
    icon: IconTruckDelivery,
  },
  { href: '/platform/cellar/selling', label: 'Selling', icon: IconTag },
];

/** Paperwork about the account, kept apart from the places so the tabs stay short */
const accountLinks = [
  {
    href: '/platform/cellar/statement',
    label: 'Statements',
    icon: IconFileText,
  },
  /* A guest the cellar is shared with sees no invoices, as on the phone */
  {
    href: '/platform/cellar/invoices',
    label: 'Invoices',
    icon: IconFileInvoice,
    holderOnly: true,
  },
  {
    href: '/platform/cellar/purchases',
    label: 'Purchases',
    icon: IconShoppingBag,
  },
  { href: '/platform/cellar/activity', label: 'Activity', icon: IconHistory },
  {
    href: '/platform/cellar/profile',
    label: 'Your details',
    icon: IconUserCircle,
  },
];

const WHATS_NEW_HREF = '/platform/cellar/whats-new';

const isOn = (pathname: string, href: string) =>
  href === '/platform/cellar' ? pathname === href : pathname.startsWith(href);

/**
 * Navigation across a member's cellar
 *
 * Two tiers: the four places a member works in as tabs on the left, and
 * their account (statements, invoices, purchases, activity, details) as
 * smaller links on the right. On a phone the bottom bar takes over. The only
 * mark is one dot on What's New while an update is unread.
 *
 * Exact matching on the cellar root, because every other tab sits beneath
 * it and a prefix test would light them all at once.
 */
const CellarTabs = () => {
  const pathname = usePathname();
  const api = useTRPC();
  const isViewer = useIsCellarViewer();
  const whatsNew = useWhatsNewDot();

  /*
    Someone the cellar is shared with is told so on every page, so a spouse
    or PA never mistakes it for their own, and a viewer knows before pressing
    anything that changes are not theirs to make.
  */
  const { data: access } = useQuery({
    ...api.cellar.access.get.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const shared =
    access && access.myRole !== 'holder'
      ? {
          holder: access.holderName,
          level:
            accessLevels[access.myRole === 'manager' ? 'manager' : 'viewer']
              .label,
        }
      : null;

  return (
    <>
      {shared && (
        <p className="text-text-muted bg-surface-muted mb-3 rounded-lg px-3 py-2 text-xs">
          You are in{' '}
          <span className="text-text-primary font-semibold">
            {shared.holder}&rsquo;s private cellar
          </span>{' '}
          · {shared.level}
        </p>
      )}
      <nav className="border-border-muted mb-6 hidden flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b pb-4 md:flex">
        {/* The four places, as one control: the page you are on is solid */}
        <div className="flex gap-1 rounded-full border border-black/[0.06] bg-black/[0.05] p-1 dark:border-white/10 dark:bg-white/[0.06]">
          {coreTabs.map((tab) => {
            const active = isOn(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm transition-all ${
                  active
                    ? 'bg-neutral-950 font-semibold text-white shadow-sm dark:bg-white dark:text-neutral-950'
                    : 'text-text-secondary hover:bg-background-primary hover:text-text-primary font-medium hover:shadow-sm'
                }`}
              >
                <Icon icon={tab.icon} size="sm" />
                {tab.label}
              </Link>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-1 gap-y-2">
          {/* Paperwork stays quiet, so it never competes with the places */}
          {accountLinks
            .filter((link) => !(isViewer && link.holderOnly))
            .map((link) => {
              const active = isOn(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs transition-colors ${
                    active
                      ? 'bg-surface-muted text-text-primary font-semibold'
                      : 'text-text-muted hover:text-text-primary font-medium'
                  }`}
                >
                  <link.icon size={14} />
                  {link.label}
                </Link>
              );
            })}
          {whatsNew.enabled && (
            <>
              <span className="bg-border-muted mx-1.5 h-5 w-px" aria-hidden />
              {/* As quiet as the paperwork; a single dot says something is unread */}
              <Link
                href={WHATS_NEW_HREF}
                aria-current={isOn(pathname, WHATS_NEW_HREF) ? 'page' : undefined}
                className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs transition-colors ${
                  isOn(pathname, WHATS_NEW_HREF)
                    ? 'bg-surface-muted text-text-primary font-semibold'
                    : 'text-text-muted hover:text-text-primary font-medium'
                }`}
              >
                <IconStars size={14} />
                What&rsquo;s New
                {whatsNew.hasNew && !isOn(pathname, WHATS_NEW_HREF) && (
                  <span
                    className="size-1.5 rounded-full bg-emerald-500"
                    aria-label="New updates"
                  />
                )}
              </Link>
            </>
          )}
        </div>
      </nav>
      <CellarPhoneTabs />
    </>
  );
};

export default CellarTabs;
