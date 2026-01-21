'use client';

import {
  IconBook,
  IconChevronDown,
  IconHelp,
  IconLayoutDashboard,
  IconMail,
  IconPackage,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';

interface NavItem {
  label: string;
  href: string;
  icon: typeof IconLayoutDashboard;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/platform/distributor',
    icon: IconLayoutDashboard,
  },
  {
    label: 'Assigned Orders',
    href: '/platform/distributor/orders',
    icon: IconPackage,
  },
];

/**
 * DistributorNav provides navigation between distributor pages
 * Responsive tabs with icons for dashboard and orders views
 */
const DistributorNav = () => {
  const pathname = usePathname();
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <nav className="border-b border-border-muted">
      <div className="flex items-center justify-between">
        {/* Main Navigation Tabs */}
        <div className="flex gap-1">
          {navItems.map((item) => {
            // Check if this is the active tab
            const isActive =
              item.href === '/platform/distributor'
                ? pathname === '/platform/distributor'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-border-brand text-text-brand'
                    : 'border-transparent text-text-muted hover:border-border-muted hover:text-text-primary'
                }`}
              >
                <Icon
                  icon={item.icon}
                  size="sm"
                  className={isActive ? 'text-text-brand' : 'text-text-muted'}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Help Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsHelpOpen(!isHelpOpen)}
            onBlur={() => setTimeout(() => setIsHelpOpen(false), 150)}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-fill-muted hover:text-text-primary"
          >
            <Icon icon={IconHelp} size="sm" />
            <span className="hidden sm:inline">Help</span>
            <Icon icon={IconChevronDown} size="xs" className={`transition-transform ${isHelpOpen ? 'rotate-180' : ''}`} />
          </button>

          {isHelpOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border-muted bg-background-primary py-1 shadow-lg">
              <Link
                href="/docs/pco-flows"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary transition-colors hover:bg-fill-muted"
              >
                <Icon icon={IconBook} size="sm" className="text-text-brand" />
                <div>
                  <div className="font-medium">Process Flow Guide</div>
                  <div className="text-xs text-text-muted">End-to-end PCO workflow</div>
                </div>
              </Link>
              <Link
                href="/platform/distributor/support"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary transition-colors hover:bg-fill-muted"
              >
                <Icon icon={IconHelp} size="sm" className="text-amber-500" />
                <div>
                  <div className="font-medium">Help Center</div>
                  <div className="text-xs text-text-muted">FAQs and guides</div>
                </div>
              </Link>
              <div className="my-1 border-t border-border-muted" />
              <Link
                href="mailto:support@craftculture.xyz"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary transition-colors hover:bg-fill-muted"
              >
                <Icon icon={IconMail} size="sm" className="text-text-muted" />
                <div>
                  <div className="font-medium">Contact Support</div>
                  <div className="text-xs text-text-muted">support@craftculture.xyz</div>
                </div>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default DistributorNav;
