'use client';

import {
  IconActivity,
  IconBuildingStore,
  IconCoin,
  IconPackage,
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
    label: 'Users',
    href: '/platform/admin/users',
    icon: IconUsers,
    description: 'Manage accounts',
  },
  {
    label: 'Partners',
    href: '/platform/admin/partners',
    icon: IconBuildingStore,
    description: 'API access',
  },
  {
    label: 'Private Orders',
    href: '/platform/admin/private-orders',
    icon: IconPackage,
    description: 'Partner orders',
  },
  {
    label: 'Commissions',
    href: '/platform/admin/commissions',
    icon: IconCoin,
    description: 'B2C payouts',
  },
  {
    label: 'Activity',
    href: '/platform/admin/activity',
    icon: IconActivity,
    description: 'Platform logs',
  },
  {
    label: 'Pricing Models',
    href: '/platform/admin/pricing-models',
    icon: IconTable,
    description: 'Formulas',
  },
  {
    label: 'Settings',
    href: '/platform/admin/settings',
    icon: IconSettings,
    description: 'Configuration',
  },
];

/**
 * Admin navigation component
 * Provides consistent navigation across all admin pages
 */
const AdminNav = () => {
  const pathname = usePathname();

  const renderNavLink = (item: NavItem, isMobile: boolean) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

    if (isMobile) {
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
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`relative block border-b-2 py-3 transition-colors ${
          isActive ? 'border-border-brand' : 'border-transparent hover:border-border-muted'
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
  };

  return (
    <nav className="border-b border-border-muted bg-white dark:bg-background-secondary">
      <div className="container mx-auto max-w-7xl">
        {/* Mobile: Horizontal scrolling tabs */}
        <div className="flex gap-1 overflow-x-auto px-4 sm:px-6 lg:hidden">
          {navItems.map((item) => renderNavLink(item, true))}
        </div>

        {/* Desktop: Evenly spaced tabs */}
        <div className="hidden px-4 sm:px-6 lg:flex lg:justify-center lg:gap-8">
          {navItems.map((item) => renderNavLink(item, false))}
        </div>
      </div>
    </nav>
  );
};

export default AdminNav;
