'use client';

import {
  IconBottle,
  IconShoppingBag,
  IconSparkles,
  IconTag,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import Icon from '@/app/_ui/components/Icon/Icon';

const tabs = [
  { href: '/platform/cellar', label: 'Your cellar', icon: IconBottle },
  { href: '/platform/cellar/selling', label: 'Selling', icon: IconTag },
  /*
    "The pool" was our word for it, not a member's. What they want to know is
    what they can add to their cellar today, so the tab says that. It lives
    under the cellar rather than at its own root so it keeps this navigation.
  */
  { href: '/platform/cellar/available', label: 'Available now', icon: IconSparkles },
  /*
    Buying is not finished when the order is placed — there is a transfer to
    send and a confirmation to wait for — so it needs somewhere to live that is
    not the catalogue it was bought from.
  */
  { href: '/platform/cellar/purchases', label: 'Purchases', icon: IconShoppingBag },
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

  return (
    <nav className="border-border-muted mb-5 flex gap-1 overflow-x-auto border-b">
      {tabs.map((tab) => {
        const isActive =
          tab.href === '/platform/cellar'
            ? pathname === tab.href
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px flex flex-shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? 'border-teal-500 text-text-primary'
                : 'text-text-muted hover:text-text-primary border-transparent'
            }`}
          >
            <Icon icon={tab.icon} size="sm" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
};

export default CellarTabs;
