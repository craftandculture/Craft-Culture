'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { getSectionFromPathname } from '@/app/_admin/components/AdminTopNav';
import { activeHref, visibleAdminNav } from '@/app/_admin/constants/adminNav';

interface AdminSectionTabsProps {
  userRole?: string;
  /** C&C staff, for the tabs only they may see */
  isStaff?: boolean;
}

/**
 * Section-aware tab bar for admin navigation
 * Renders horizontal tabs for the current section, sticky below header
 */
const AdminSectionTabs = ({ userRole, isStaff = false }: AdminSectionTabsProps) => {
  const pathname = usePathname();
  const section = getSectionFromPathname(pathname);
  // Operator and staff-only pages are filtered where the menu is defined
  const tabs = visibleAdminNav({ role: userRole, isStaff }).find((item) => item.key === section)?.links;
  const current = activeHref(pathname, tabs?.map((tab) => tab.href) ?? []);

  if (!tabs?.length) return null;

  return (
    <div className="border-b border-border-muted bg-white dark:bg-background-secondary">
      <div className="container">
        <nav className="-mb-px flex gap-0 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tab.href === current;

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
