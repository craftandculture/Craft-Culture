'use client';

import {
  IconBuildingWarehouse,
  IconCoin,
  IconHome2,
  IconPackage,
  IconSettings,
  IconShip,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { IconProp } from '@/app/_ui/components/Icon/Icon';
import Icon from '@/app/_ui/components/Icon/Icon';

interface AdminNavItem {
  label: string;
  href: string;
  icon: IconProp;
  section: string;
}

const adminNavItems: AdminNavItem[] = [
  { label: 'Home', href: '/platform/admin/home', icon: IconHome2, section: 'home' },
  { label: 'Orders', href: '/platform/admin/private-orders', icon: IconPackage, section: 'orders' },
  { label: 'Logistics', href: '/platform/admin/logistics', icon: IconShip, section: 'logistics' },
  { label: 'Warehouse', href: '/platform/admin/wms', icon: IconBuildingWarehouse, section: 'warehouse' },
  { label: 'Partners', href: '/platform/admin/users', icon: IconUsers, section: 'partners' },
  { label: 'Finance', href: '/platform/admin/commissions', icon: IconCoin, section: 'finance' },
  { label: 'System', href: '/platform/admin/activity', icon: IconSettings, section: 'system' },
];

/** Detect which top-level section the current pathname belongs to */
const getSectionFromPathname = (pathname: string) => {
  if (pathname === '/platform/admin/home' || pathname === '/platform/admin') return 'home';

  // Orders
  if (
    pathname.startsWith('/platform/admin/private-orders') ||
    pathname.startsWith('/platform/admin/zoho-sales-orders') ||
    pathname.startsWith('/platform/admin/source') ||
    pathname.startsWith('/platform/admin/quote-approvals') ||
    pathname.startsWith('/platform/quotes') ||
    pathname.startsWith('/platform/my-quotes')
  )
    return 'orders';

  // Logistics
  if (pathname.startsWith('/platform/admin/logistics')) return 'logistics';

  // Warehouse
  if (pathname.startsWith('/platform/admin/wms') || pathname.startsWith('/platform/admin/stock-explorer'))
    return 'warehouse';

  // Partners
  if (
    pathname.startsWith('/platform/admin/users') ||
    pathname.startsWith('/platform/admin/partners') ||
    pathname.startsWith('/platform/admin/wine-partners')
  )
    return 'partners';

  // Finance
  if (
    pathname.startsWith('/platform/admin/commissions') ||
    pathname.startsWith('/platform/admin/pricing')
  )
    return 'finance';

  // System
  if (
    pathname.startsWith('/platform/admin/activity') ||
    pathname.startsWith('/platform/admin/zoho-import') ||
    pathname.startsWith('/platform/admin/settings') ||
    pathname.startsWith('/platform/admin/agents')
  )
    return 'system';

  return 'home';
};

/**
 * Admin top navigation bar with 6 section items
 * Replaces the old sidebar + header pill navigation
 */
const AdminTopNav = () => {
  const pathname = usePathname();
  const currentSection = getSectionFromPathname(pathname);

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {adminNavItems.map((item) => {
        const isActive = currentSection === item.section;

        return (
          <Link
            key={item.section}
            href={item.href}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-fill-brand/10 text-text-brand'
                : 'text-text-secondary hover:bg-fill-primary-hover hover:text-text-primary'
            }`}
          >
            <Icon icon={item.icon} size="sm" className={isActive ? 'text-text-brand' : ''} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export { getSectionFromPathname };
export default AdminTopNav;
