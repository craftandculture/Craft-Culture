'use client';

import { resolveAccessProfile } from '@/app/_auth/constants/accessProfiles';
import type { User } from '@/database/schema';

import MobileNav from './MobileNav';

interface PlatformMobileNavProps {
  user: Pick<User, 'role' | 'customerType'> & {
    partner?: { type: string } | null;
  };
}

/**
 * Platform-specific mobile navigation that builds sections based on user role
 */
const PlatformMobileNav = ({ user }: PlatformMobileNavProps) => {
  const sections = [];
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

  // WMS Operator sections — limited admin nav
  if (user.role === 'wms_operator') {
    sections.push({
      title: 'Orders',
      links: [{ href: '/platform/admin/private-orders', label: 'Private Orders' }],
    });
    sections.push({
      title: 'Stock',
      links: [
        { href: '/platform/admin/stock-explorer', label: 'Stock Explorer' },
      ],
    });
    sections.push({
      title: 'Warehouse',
      links: [
        { href: '/platform/admin/wms', label: 'WMS Dashboard' },
        { href: '/platform/admin/wms/receive', label: 'Receiving' },
        { href: '/platform/admin/wms/pick', label: 'Pick' },
        { href: '/platform/admin/wms/dispatch', label: 'Dispatch' },
        { href: '/platform/admin/wms/labels', label: 'Labels' },
        { href: '/platform/admin/wms/movements', label: 'Movements' },
        { href: '/platform/admin/wms/cycle-count', label: 'Cycle Count' },
      ],
    });
  }

  // Admin sections — 6-section IA matching top nav
  if (user.role === 'admin') {
    sections.push({
      title: 'Home',
      links: [{ href: '/platform/admin/home', label: 'Home' }],
    });
    sections.push({
      title: 'Orders',
      links: [
        { href: '/platform/admin', label: 'Overview' },
        { href: '/platform/admin/private-orders', label: 'Private Orders' },
        { href: '/platform/admin/zoho-sales-orders', label: 'Zoho Sales' },
        { href: '/platform/admin/source', label: 'Source' },
        { href: '/platform/admin/quote-approvals', label: 'Approvals' },
        { href: '/platform/quotes', label: 'Quotes' },
        { href: '/platform/my-quotes', label: 'My Quotes' },
      ],
    });
    sections.push({
      title: 'Logistics',
      links: [
        { href: '/platform/admin/logistics', label: 'Dashboard' },
        { href: '/platform/admin/logistics/shipments', label: 'Shipments' },
        { href: '/platform/admin/logistics/quotes', label: 'Quotes' },
        { href: '/platform/admin/logistics/requests', label: 'Requests' },
        { href: '/platform/admin/logistics/invoices', label: 'Invoices' },
        { href: '/platform/admin/logistics/reports', label: 'Reports' },
      ],
    });
    sections.push({
      title: 'Stock',
      links: [
        { href: '/platform/admin/stock-explorer', label: 'Stock Explorer' },
      ],
    });
    sections.push({
      title: 'Warehouse',
      links: [
        { href: '/platform/admin/wms', label: 'WMS Dashboard' },
        { href: '/platform/admin/wms/receive', label: 'Receiving' },
        { href: '/platform/admin/wms/pick', label: 'Pick' },
        { href: '/platform/admin/wms/dispatch', label: 'Dispatch' },
        { href: '/platform/admin/wms/labels', label: 'Labels' },
        { href: '/platform/admin/wms/movements', label: 'Movements' },
        { href: '/platform/admin/wms/cycle-count', label: 'Cycle Count' },
      ],
    });
    sections.push({
      title: 'Partners',
      links: [
        { href: '/platform/admin/users', label: 'Users' },
        { href: '/platform/admin/partners', label: 'Distributors' },
        { href: '/platform/admin/wine-partners', label: 'Wine Partners' },
        { href: '/platform/admin/collectors', label: 'Collectors' },
      ],
    });
    sections.push({
      title: 'Finance',
      links: [
        { href: '/platform/admin/commissions', label: 'Commissions' },
        { href: '/platform/admin/pricing', label: 'Pricing' },
        { href: '/platform/admin/pricing-calculator', label: 'Calculator' },
        { href: '/platform/admin/triangulation', label: 'Triangulation' },
      ],
    });
    sections.push({
      title: 'System',
      links: [
        { href: '/platform/admin/activity', label: 'Activity' },
        { href: '/platform/admin/agents', label: 'Agents' },
        { href: '/platform/admin/zoho-import', label: 'Zoho Import' },
        { href: '/platform/admin/settings', label: 'Settings' },
      ],
    });
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

  return <MobileNav sections={sections} />;
};

export default PlatformMobileNav;
