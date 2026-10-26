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

/** Shown once staff switch it on; carries a dot while there is something new */
const whatsNewLink = {
  href: '/platform/cellar/whats-new',
  label: 'What’s New',
  icon: IconStars,
  holderOnly: false,
};

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
      <nav className="border-border-muted mb-6 hidden items-end justify-between gap-4 border-b md:flex">
        <div className="flex gap-0.5">
          {coreTabs.map((tab) => {
            const active = isOn(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`-mb-px flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border-text-primary text-text-primary font-semibold'
                    : 'text-text-muted hover:text-text-primary border-transparent'
                }`}
              >
                <Icon icon={tab.icon} size="sm" />
                {tab.label}
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1 pb-2">
          {[...accountLinks, ...(whatsNew.enabled ? [whatsNewLink] : [])]
            .filter((link) => !(isViewer && link.holderOnly))
            .map((link) => {
              const active = isOn(pathname, link.href);
              const dot = link === whatsNewLink && whatsNew.hasNew && !active;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-8 items-center gap-1 whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-text-primary text-surface-primary'
                      : 'bg-surface-muted text-text-secondary hover:bg-fill-primary-hover hover:text-text-primary'
                  }`}
                >
                  <link.icon size={14} />
                  {link.label}
                  {dot && (
                    <span className="size-1.5 rounded-full bg-emerald-500" aria-label="New updates" />
                  )}
                </Link>
              );
            })}
        </div>
      </nav>
      <CellarPhoneTabs />
    </>
  );
};

export default CellarTabs;
