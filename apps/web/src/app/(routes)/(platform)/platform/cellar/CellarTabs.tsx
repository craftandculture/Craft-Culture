'use client';

import {
  IconBottle,
  IconFileInvoice,
  IconFileText,
  IconHistory,
  IconShoppingBag,
  IconSparkles,
  IconTag,
  IconTruckDelivery,
  IconUserCircle,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import accessLevels from '@/app/_cellar/constants/accessLevels';
import useIsCellarViewer from '@/app/_cellar/hooks/useIsCellarViewer';
import Icon from '@/app/_ui/components/Icon/Icon';
import useTRPC from '@/lib/trpc/browser';

import CellarPhoneTabs from './CellarPhoneTabs';

const tabs = [
  { href: '/platform/cellar', label: 'Your cellar', icon: IconBottle },
  {
    href: '/platform/cellar/deliveries',
    label: 'Deliveries',
    icon: IconTruckDelivery,
  },
  { href: '/platform/cellar/selling', label: 'Selling', icon: IconTag },
  /*
    "The pool" was our word for it, not a member's. What they want to know is
    what they can add to their cellar today, so the tab says that. It lives
    under the cellar rather than at its own root so it keeps this navigation.
  */
  { href: '/platform/cellar/available', label: 'The Cellar List', icon: IconSparkles },
  /*
    Buying is not finished when the order is placed — there is a transfer to
    send and a confirmation to wait for — so it needs somewhere to live that is
    not the catalogue it was bought from.
  */
  {
    href: '/platform/cellar/statement',
    label: 'Statements',
    icon: IconFileText,
  },
  // Every arrival, delivery and sale the day it happened; the statement summarises it
  { href: '/platform/cellar/activity', label: 'Activity', icon: IconHistory },
  {
    href: '/platform/cellar/purchases',
    label: 'Purchases',
    icon: IconShoppingBag,
  },
  /* A guest the cellar is shared with sees no invoices, as on the phone */
  {
    href: '/platform/cellar/invoices',
    label: 'Invoices',
    icon: IconFileInvoice,
    holderOnly: true,
  },
  {
    href: '/platform/cellar/profile',
    label: 'Your details',
    icon: IconUserCircle,
  },
];

/**
 * Navigation across a member's three places
 *
 * What they hold, what they have offered, and what else is for sale. Until
 * now the cellar was a single screen, which was right when the only thing a
 * member could do was look at their own wine — it stops being right the moment
 * they can also sell it and buy someone else's.
 *
 * Exact matching on the cellar root, because every other tab sits beneath it
 * and a prefix test would light all three at once.
 */
const CellarTabs = () => {
  const pathname = usePathname();
  const api = useTRPC();
  const isViewer = useIsCellarViewer();

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
        <p className="text-text-muted mb-3 rounded-lg bg-emerald-50/60 px-3 py-2 text-xs dark:bg-emerald-500/10">
          You are in{' '}
          <span className="text-text-primary font-semibold">
            {shared.holder}&rsquo;s private cellar
          </span>{' '}
          · {shared.level}
        </p>
      )}
    <nav className="border-border-muted -mx-3 mb-6 hidden gap-0.5 overflow-x-auto border-b px-3 sm:mx-0 sm:px-0 md:flex">
      {tabs.filter((tab) => !(isViewer && tab.holderOnly)).map((tab) => {
        const isActive =
          tab.href === '/platform/cellar'
            ? pathname === tab.href
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px flex min-h-11 flex-shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-2.5 lg:px-3 text-sm font-medium transition-colors ${
              isActive
                ? 'border-text-primary text-text-primary font-semibold'
                : 'text-text-muted hover:text-text-primary border-transparent'
            }`}
          >
            <Icon icon={tab.icon} size="sm" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
    <CellarPhoneTabs />
    </>
  );
};

export default CellarTabs;
