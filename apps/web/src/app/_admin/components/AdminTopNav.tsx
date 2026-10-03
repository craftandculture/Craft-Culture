'use client';

import {
  IconBinoculars,
  IconBuildingWarehouse,
  IconCoin,
  IconDatabaseSearch,
  IconHome2,
  IconListCheck,
  IconPackage,
  IconShip,
  IconUsers,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { IconProp } from '@/app/_ui/components/Icon/Icon';
import Icon from '@/app/_ui/components/Icon/Icon';
import useTRPC from '@/lib/trpc/browser';

interface AdminTopNavProps {
  userRole?: string;
}

interface AdminNavItem {
  label: string;
  href: string;
  icon: IconProp;
  section: string;
}

const adminNavItems: AdminNavItem[] = [
  { label: 'Home', href: '/platform/admin/home', icon: IconHome2, section: 'home' },
  { label: 'Tasks', href: '/platform/admin/tasks', icon: IconListCheck, section: 'tasks' },
  { label: 'Orders', href: '/platform/admin', icon: IconPackage, section: 'orders' },
  { label: 'Logistics', href: '/platform/admin/logistics', icon: IconShip, section: 'logistics' },
  { label: 'Stock', href: '/platform/admin/stock-explorer', icon: IconDatabaseSearch, section: 'stock' },
  { label: 'Warehouse', href: '/platform/admin/wms', icon: IconBuildingWarehouse, section: 'warehouse' },
  { label: 'Partners', href: '/platform/admin/users', icon: IconUsers, section: 'partners' },
  { label: 'Finance', href: '/platform/admin/commissions', icon: IconCoin, section: 'finance' },
  { label: 'Intelligence', href: '/platform/admin/agents', icon: IconBinoculars, section: 'agents' },
];

/** Detect which top-level section the current pathname belongs to */
const getSectionFromPathname = (pathname: string) => {
  if (pathname === '/platform/admin/home') return 'home';
  if (pathname.startsWith('/platform/admin/tasks')) return 'tasks';

  // Orders (incl. the PCO dashboard overview at /platform/admin)
  if (
    pathname === '/platform/admin' ||
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

  // Stock
  if (pathname.startsWith('/platform/admin/stock-explorer')) return 'stock';

  // Warehouse
  if (pathname.startsWith('/platform/admin/wms'))
    return 'warehouse';

  // Partners
  if (
    pathname.startsWith('/platform/admin/users') ||
    pathname.startsWith('/platform/admin/clients') ||
    pathname.startsWith('/platform/admin/partners') ||
    pathname.startsWith('/platform/admin/wine-partners')
  )
    return 'partners';

  // Finance
  if (
    pathname.startsWith('/platform/admin/commissions') ||
    pathname.startsWith('/platform/admin/pricing') ||
    pathname.startsWith('/platform/admin/quote-builder') ||
    pathname.startsWith('/platform/admin/lpo') ||
    pathname.startsWith('/platform/admin/daily-sales') ||
    pathname.startsWith('/platform/admin/triangulation')
  )
    return 'finance';

  // Agents
  if (pathname.startsWith('/platform/admin/agents'))
    return 'agents';

  // Settings (gear icon — no top nav item, but still a section for tabs)
  if (
    pathname.startsWith('/platform/admin/activity') ||
    pathname.startsWith('/platform/admin/zoho-import') ||
    pathname.startsWith('/platform/admin/settings')
  )
    return 'settings';

  return 'home';
};

/** Sections visible to WMS operators */
const operatorSections = new Set(['tasks', 'warehouse', 'stock', 'orders']);

/**
 * Admin top navigation bar with 6 section items
 * Replaces the old sidebar + header pill navigation
 */
const AdminTopNav = ({ userRole }: AdminTopNavProps) => {
  const pathname = usePathname();
  const currentSection = getSectionFromPathname(pathname);
  const api = useTRPC();

  // Your own open parts on Team Tasks; red when any is overdue. Partner
  // logins with an admin role are refused by the server and show no badge.
  const { data: taskCount } = useQuery({
    ...api.teamTasks.myCount.queryOptions(),
    retry: false,
    refetchInterval: 60_000,
  });

  const visibleItems = userRole === 'wms_operator'
    ? adminNavItems.filter((item) => operatorSections.has(item.section))
    : adminNavItems;

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {visibleItems.map((item) => {
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
            {item.section === 'tasks' && taskCount && taskCount.open > 0 && (
              <span
                className={`ml-0.5 min-w-[18px] rounded-full px-1.5 text-center text-[11px] font-semibold leading-[18px] ${
                  taskCount.overdue > 0 ? 'bg-fill-danger text-text-danger-on-fill' : 'bg-fill-brand/15 text-text-brand'
                }`}
                title={taskCount.overdue > 0 ? `${taskCount.overdue} overdue` : `${taskCount.open} open`}
              >
                {taskCount.open}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
};

export { getSectionFromPathname };
export default AdminTopNav;
