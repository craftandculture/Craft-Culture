'use client';

import {
  IconBottle,
  IconDots,
  IconFileInvoice,
  IconFileText,
  IconHistory,
  IconShoppingBag,
  IconSparkles,
  IconTag,
  IconTruckDelivery,
  IconUserCircle,
  IconX,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import useIsCellarViewer from '@/app/_cellar/hooks/useIsCellarViewer';

const isOn = (pathname: string, href: string) =>
  href === '/platform/cellar' ? pathname === href : pathname.startsWith(href);

/**
 * The member's navigation on a phone: four places within thumb reach
 *
 * Your cellar, the Cellar List, Deliveries and Invoices are what a member comes
 * back for; everything else sits under More, in a sheet from the bottom. A
 * guest the cellar is shared with sees no Invoices, as on the desktop.
 *
 * Hidden from tablet width up, where the tabs across the top return.
 */
const CellarPhoneTabs = () => {
  const pathname = usePathname();
  const isViewer = useIsCellarViewer();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => setMoreOpen(false), [pathname]);

  const main = [
    { href: '/platform/cellar', label: 'Your cellar', icon: IconBottle },
    { href: '/platform/cellar/available', label: 'Cellar List', icon: IconSparkles },
    { href: '/platform/cellar/deliveries', label: 'Deliveries', icon: IconTruckDelivery },
    ...(isViewer ? [] : [{ href: '/platform/cellar/invoices', label: 'Invoices', icon: IconFileInvoice }]),
  ];

  const more = [
    { href: '/platform/cellar/selling', label: 'Selling', icon: IconTag },
    { href: '/platform/cellar/purchases', label: 'Purchases', icon: IconShoppingBag },
    { href: '/platform/cellar/statement', label: 'Statements', icon: IconFileText },
    { href: '/platform/cellar/activity', label: 'Activity', icon: IconHistory },
    { href: '/platform/cellar/profile', label: 'Your details', icon: IconUserCircle },
  ];

  const moreActive = more.some((item) => isOn(pathname, item.href));

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/30"
            onClick={() => setMoreOpen(false)}
          />
          <div className="bg-background-primary absolute inset-x-0 bottom-0 rounded-t-3xl px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] shadow-2xl">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-text-primary text-base font-semibold">More</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="text-text-muted grid size-9 place-items-center rounded-full bg-black/[0.05] dark:bg-white/[0.08]"
                aria-label="Close"
              >
                <IconX size={18} />
              </button>
            </div>
            <ul className="flex flex-col">
              {more.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-text-primary flex min-h-12 items-center gap-3 rounded-xl px-2 text-[15px] active:bg-black/[0.05] dark:active:bg-white/[0.08]"
                  >
                    <item.icon size={20} className="text-text-muted" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <nav
        aria-label="Your cellar"
        className="border-border-muted bg-background-primary/95 fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto flex max-w-md px-2 pt-1 pb-[calc(env(safe-area-inset-bottom,0px)+2px)]">
          {main.map((item) => {
            const active = isOn(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-px text-[10px] ${
                  active ? 'text-text-primary font-semibold' : 'text-text-muted'
                }`}
              >
                <item.icon size={20} stroke={active ? 2.1 : 1.6} />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-px text-[10px] ${
              moreActive ? 'text-text-primary font-semibold' : 'text-text-muted'
            }`}
          >
            <IconDots size={20} stroke={moreActive ? 2.1 : 1.6} />
            More
          </button>
        </div>
      </nav>
    </>
  );
};

export default CellarPhoneTabs;
