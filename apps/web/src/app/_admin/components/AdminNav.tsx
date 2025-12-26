'use client';

import {
  IconActivity,
  IconBuildingStore,
  IconCoin,
  IconFileText,
  IconSettings,
  IconTable,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

interface NavItem {
  label: string;
  href: string;
  icon: typeof IconUsers;
  description: string;
}

const navItems: NavItem[] = [
  {
    label: 'Quote Approvals',
    href: '/platform/admin/quote-approvals',
    icon: IconFileText,
    description: 'Review and approve customer quotes',
  },
  {
    label: 'Commissions',
    href: '/platform/admin/commissions',
    icon: IconCoin,
    description: 'Manage B2C commission payouts',
  },
  {
    label: 'User Management',
    href: '/platform/admin/users',
    icon: IconUsers,
    description: 'Approve and manage user accounts',
  },
  {
    label: 'Partners',
    href: '/platform/admin/partners',
    icon: IconBuildingStore,
    description: 'Manage retail partner API access',
  },
  {
    label: 'Activity Feed',
    href: '/platform/admin/activity',
    icon: IconActivity,
    description: 'Monitor platform activity',
  },
  {
    label: 'Pricing Models',
    href: '/platform/admin/pricing-models',
    icon: IconTable,
    description: 'Manage pricing formulas',
  },
  {
    label: 'Settings',
    href: '/platform/admin/settings',
    icon: IconSettings,
    description: 'System configuration',
  },
];

/**
 * Admin navigation component
 * Provides consistent navigation across all admin pages
 */
const AdminNav = () => {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border-muted bg-white dark:bg-background-secondary">
      <div className="container mx-auto max-w-7xl">
        {/* Mobile: Horizontal scrolling tabs */}
        <div className="flex gap-1 overflow-x-auto px-4 sm:px-6 lg:hidden">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-border-brand text-text-brand'
                    : 'border-transparent text-text-muted hover:border-border-muted hover:text-text-primary'
                }`}
              >
                <Icon icon={item.icon} size="sm" />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Desktop: Full width tabs with descriptions */}
        <div className="hidden lg:flex lg:gap-6 px-4 sm:px-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col border-b-2 py-4 transition-colors ${
                  isActive
                    ? 'border-border-brand'
                    : 'border-transparent hover:border-border-muted'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    icon={item.icon}
                    size="sm"
                    className={isActive ? 'text-text-brand' : 'text-text-muted'}
                  />
                  <Typography
                    variant="bodySm"
                    className={`font-medium ${isActive ? 'text-text-brand' : 'text-text-primary'}`}
                  >
                    {item.label}
                  </Typography>
                </div>
                <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                  {item.description}
                </Typography>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default AdminNav;
