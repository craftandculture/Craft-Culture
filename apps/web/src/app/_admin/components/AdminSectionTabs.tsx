'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { getSectionFromPathname } from '@/app/_admin/components/AdminTopNav';

interface TabItem {
  label: string;
  href: string;
}

const sectionTabs: Record<string, TabItem[]> = {
  orders: [
    { label: 'Private Orders', href: '/platform/admin/private-orders' },
    { label: 'Zoho Sales', href: '/platform/admin/zoho-sales-orders' },
    { label: 'Source', href: '/platform/admin/source' },
    { label: 'Logistics', href: '/platform/admin/logistics' },
    { label: 'Approvals', href: '/platform/admin/quote-approvals' },
    { label: 'Quotes', href: '/platform/quotes' },
    { label: 'My Quotes', href: '/platform/my-quotes' },
  ],
  warehouse: [
    { label: 'Dashboard', href: '/platform/admin/wms' },
    { label: 'Receiving', href: '/platform/admin/wms/receiving' },
    { label: 'Pick', href: '/platform/admin/wms/pick' },
    { label: 'Dispatch', href: '/platform/admin/wms/dispatch' },
    { label: 'Labels', href: '/platform/admin/wms/labels' },
    { label: 'Movements', href: '/platform/admin/wms/movements' },
    { label: 'Stock Explorer', href: '/platform/admin/stock-explorer' },
    { label: 'Cycle Count', href: '/platform/admin/wms/cycle-count' },
  ],
  partners: [
    { label: 'Users', href: '/platform/admin/users' },
    { label: 'Distributors', href: '/platform/admin/partners' },
    { label: 'Wine Partners', href: '/platform/admin/wine-partners' },
  ],
  finance: [
    { label: 'Commissions', href: '/platform/admin/commissions' },
    { label: 'Pricing', href: '/platform/admin/pricing' },
    { label: 'Calculator', href: '/platform/admin/pricing-calculator' },
  ],
  system: [
    { label: 'Activity', href: '/platform/admin/activity' },
    { label: 'Agents', href: '/platform/admin/agents' },
    { label: 'Zoho Import', href: '/platform/admin/zoho-import' },
    { label: 'Settings', href: '/platform/admin/settings' },
  ],
};

/**
 * Section-aware tab bar for admin navigation
 * Renders horizontal tabs for the current section, sticky below header
 */
const AdminSectionTabs = () => {
  const pathname = usePathname();
  const section = getSectionFromPathname(pathname);
  const tabs = sectionTabs[section];

  if (!tabs) return null;

  return (
    <div className="sticky top-14 z-40 border-b border-border-muted bg-white dark:bg-background-secondary">
      <div className="container">
        <nav className="-mb-px flex gap-0 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-fill-brand text-text-brand'
                    : 'border-transparent text-text-muted hover:border-border-primary hover:text-text-primary'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default AdminSectionTabs;
