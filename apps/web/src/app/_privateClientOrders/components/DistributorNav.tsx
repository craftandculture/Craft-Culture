'use client';

import { IconLayoutDashboard, IconPackage } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

  return (
    <nav className="border-b border-border-muted">
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
    </nav>
  );
};

export default DistributorNav;
