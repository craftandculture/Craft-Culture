'use client';

import {
  IconActivity,
  IconBottle,
  IconBuildingStore,
  IconBuildingWarehouse,
  IconChevronLeft,
  IconChevronRight,
  IconCoin,
  IconCurrencyDollar,
  IconFileImport,
  IconMenu2,
  IconPackage,
  IconReceipt,
  IconSearch,
  IconSettings,
  IconShip,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import Icon from '@/app/_ui/components/Icon/Icon';
import Sheet from '@/app/_ui/components/Sheet/Sheet';
import SheetContent from '@/app/_ui/components/Sheet/SheetContent';
import SheetTitle from '@/app/_ui/components/Sheet/SheetTitle';
import SheetTrigger from '@/app/_ui/components/Sheet/SheetTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';
import useIsMobile from '@/app/_ui/hooks/useIsMobile';

interface NavItem {
  label: string;
  href: string;
  icon: typeof IconUsers;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'People',
    items: [
      { label: 'Users', href: '/platform/admin/users', icon: IconUsers },
      { label: 'Distributors', href: '/platform/admin/partners', icon: IconBuildingStore },
      { label: 'Partners', href: '/platform/admin/wine-partners', icon: IconBottle },
    ],
  },
  {
    title: 'Orders',
    items: [
      { label: 'Private Clients', href: '/platform/admin/private-orders', icon: IconPackage },
      { label: 'Zoho Sales', href: '/platform/admin/zoho-sales-orders', icon: IconReceipt },
      { label: 'Source', href: '/platform/admin/source', icon: IconSearch },
      { label: 'Logistics', href: '/platform/admin/logistics', icon: IconShip },
      { label: 'WMS', href: '/platform/admin/wms', icon: IconBuildingWarehouse },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Commissions', href: '/platform/admin/commissions', icon: IconCoin },
      { label: 'Pricing', href: '/platform/admin/pricing', icon: IconCurrencyDollar },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Activity', href: '/platform/admin/activity', icon: IconActivity },
      { label: 'Zoho Import', href: '/platform/admin/zoho-import', icon: IconFileImport },
      { label: 'Settings', href: '/platform/admin/settings', icon: IconSettings },
    ],
  },
];

interface AdminSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

/**
 * Admin sidebar navigation component
 * Renders grouped navigation with collapse support
 * Mobile: touch scrolling enabled for scanner devices
 */
const AdminSidebar = ({ isCollapsed, onToggleCollapse }: AdminSidebarProps) => {
  const pathname = usePathname();
  const isMobile = useIsMobile();

  const renderNavItem = (item: NavItem, collapsed: boolean) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-fill-brand/10 text-text-brand'
            : 'text-text-secondary hover:bg-fill-primary-hover hover:text-text-primary'
        } ${collapsed ? 'justify-center' : ''}`}
        title={collapsed ? item.label : undefined}
      >
        <Icon icon={item.icon} size={collapsed ? 'lg' : 'sm'} className={isActive ? 'text-text-brand' : ''} />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  const renderNavContent = (collapsed: boolean) => (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className={`flex h-14 items-center border-b border-border-muted px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}
      >
        {!collapsed && (
          <Typography variant="bodySm" className="font-semibold uppercase tracking-wider text-text-muted">
            Admin
          </Typography>
        )}
        {!isMobile && (
          <button
            onClick={onToggleCollapse}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-fill-primary-hover hover:text-text-primary"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon icon={collapsed ? IconChevronRight : IconChevronLeft} size="sm" />
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto overscroll-contain p-2 touch-pan-y">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-4">
            {!collapsed && (
              <Typography
                variant="bodyXs"
                className="mb-2 px-3 font-semibold uppercase tracking-wider text-text-muted"
              >
                {group.title}
              </Typography>
            )}
            {collapsed && <div className="mb-2 h-px bg-border-muted" />}
            <div className="flex flex-col gap-0.5">{group.items.map((item) => renderNavItem(item, collapsed))}</div>
          </div>
        ))}
      </nav>
    </div>
  );

  // Mobile: Render as a sheet/drawer
  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <button className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-fill-brand text-white shadow-lg transition-transform hover:scale-105 active:scale-95 md:hidden">
            <Icon icon={IconMenu2} size="md" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 overflow-y-auto p-0">
          <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
          {renderNavContent(false)}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Render as fixed sidebar
  return (
    <aside
      className={`hidden h-[calc(100vh-64px)] flex-shrink-0 border-r border-border-muted bg-white transition-all duration-300 dark:bg-background-secondary md:block ${
        isCollapsed ? 'w-16' : 'w-56'
      }`}
    >
      {renderNavContent(isCollapsed)}
    </aside>
  );
};

export default AdminSidebar;
