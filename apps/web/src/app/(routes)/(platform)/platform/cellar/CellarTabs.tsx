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

/** The places a member works in: their wine, getting it home, selling it and buying more */
const coreTabs = [
  { href: '/platform/cellar', label: 'Your cellar', icon: IconBottle },
  {
    href: '/platform/cellar/deliveries',
    label: 'Deliveries',
    icon: IconTruckDelivery,
  },
  { href: '/platform/cellar/selling', label: 'Selling', icon: IconTag },
  /*
    "The pool" was our word for it, not a member's. What they want to know is
    what they can add to their cellar today, so the tab says that.
  */
  {
    href: '/platform/cellar/available',
    label: 'The Cellar List',
    icon: IconSparkles,
  },
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
 * smaller links on the right. On a phone the bottom bar takes over.
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
        <div className="bg-surface-muted flex gap-1 rounded-full p-1">
          {coreTabs.map((tab) => {
            const active = isOn(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm transition-all ${
                  active
                    ? 'bg-text-primary text-surface-primary font-semibold shadow-sm'
                    : 'text-text-secondary hover:bg-background-primary hover:text-text-primary font-medium'
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
              <Link
                href={WHATS_NEW_HREF}
                aria-current={isOn(pathname, WHATS_NEW_HREF) ? 'page' : undefined}
                className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                  isOn(pathname, WHATS_NEW_HREF)
                    ? 'border-emerald-700 bg-emerald-700 text-white dark:border-emerald-500 dark:bg-emerald-600'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20'
                }`}
              >
                <IconStars size={15} />
                What&rsquo;s New
                {whatsNew.hasNew && !isOn(pathname, WHATS_NEW_HREF) && (
                  <span className="min-w-[18px] rounded-full bg-emerald-600 px-1.5 text-center text-[11px] leading-[18px] font-semibold text-white tabular-nums">
                    {whatsNew.count}
                  </span>
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
