'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';

import { visibleAdminNav } from '@/app/_admin/constants/adminNav';
import { resolveAccessProfile } from '@/app/_auth/constants/accessProfiles';
import ThemeToggle from '@/app/_ui/components/ThemeToggle/ThemeToggle';
import type { User } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

import MobileNav, { type NavSection } from './MobileNav';

interface PlatformMobileNavProps {
  user: Pick<User, 'role' | 'customerType'> & {
    partner?: { type: string } | null;
  };
  /** C&C staff, for the admin pages only they may see */
  isStaff?: boolean;
}

/**
 * Platform-specific mobile navigation that builds sections based on user role
 */
const PlatformMobileNav = ({ user, isStaff = false }: PlatformMobileNavProps) => {
  const api = useTRPC();
  const pathname = usePathname();
  const isTeam = user.role === 'admin' || user.role === 'wms_operator';
  // Shared Team Tasks jobs, as the desktop bar shows them to partners
  const { data: partnerTasks } = useQuery({
    ...api.teamTasks.partnerCount.queryOptions(),
    enabled: !isTeam,
    retry: false,
    refetchInterval: 120_000,
  });
  const sections: NavSection[] = [];
  const access = resolveAccessProfile({
    role: user.role,
    customerType: user.customerType,
    partnerType: user.partner?.type,
  });

  // An account that holds wine with us gets its inventory in place of Quotes.
  if (access.can.ownsStock) {
    sections.push({
      title: access.kind === 'collector' ? 'Cellar' : 'Inventory',
      links: [
        { href: access.home, label: access.inventoryLabel },
        // Wine partners only — a collector's cellar is a different screen.
        ...(access.kind === 'wine_partner'
          ? [
              { href: '/platform/partner/movements', label: 'Movements' },
              { href: '/platform/partner/activity', label: 'Activity' },
            ]
          : []),
      ],
    });
  } else if (user.role !== 'admin') {
    // Quotes section - for non-wine partners, non-admins (admins get Quotes under Orders section)
    const quotesLinks = [
      { href: '/platform/quotes', label: 'Create Quote' },
      { href: '/platform/my-quotes', label: 'My Quotes' },
    ];
    sections.push({ title: 'Quotes', links: quotesLinks });
  }

  // Private Clients section
  if (access.can.privateOrders) {
    sections.push({
      title: 'Private Clients',
      links: [{ href: '/platform/private-orders', label: 'My Orders' }],
    });
    sections.push({
      title: 'CRM',
      links: [{ href: '/platform/clients', label: 'Clients' }],
    });
  }

  // Distributor section - for B2B users and distributor partners (not admins)
  if (access.can.distributorTools) {
    sections.push({
      title: 'Private Clients',
      links: [
        { href: '/platform/distributor', label: 'Dashboard' },
        { href: '/platform/distributor/orders', label: 'Assigned Orders' },
      ],
    });
  }

  // Partners with a job shared with them on Team Tasks
  if (!isTeam && partnerTasks?.jobs) {
    sections.push({ title: 'Tasks', links: [{ href: '/platform/tasks', label: 'Tasks' }] });
  }

  // The admin menu, from the one definition the desktop bar and tabs also read
  if (isTeam) {
    for (const item of visibleAdminNav({ role: user.role, isStaff })) {
      sections.push({
        title: item.label,
        icon: item.icon,
        links: item.links.length ? item.links.map((link) => ({ href: link.href, label: link.label })) : [{ href: item.href, label: item.label }],
      });
    }
  }

  // Support routes to the desk that knows this kind of account.
  const getSupportHref = () => {
    if (access.can.ownsStock) return '/platform/partner/support';
    if (access.can.distributorTools) return '/platform/distributor/support';
    return '/platform/support';
  };

  sections.push({
    title: 'Help',
    links: [{ href: getSupportHref(), label: 'Support' }],
  });

  // A member in their cellar has its own tabs; a second menu would only compete
  if (access.kind === 'collector' && pathname.startsWith('/platform/cellar')) return null;

  return <MobileNav sections={sections} footer={<><span className="text-sm text-text-muted">Theme</span><ThemeToggle /></>} />;
};

export default PlatformMobileNav;
