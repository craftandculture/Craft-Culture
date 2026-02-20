'use client';

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
  const isWinePartner = user.customerType === 'private_clients' && user.partner?.type === 'wine_partner';

  // Local Stock section - for Wine Partners only (replaces Quotes)
  if (isWinePartner) {
    sections.push({
      title: 'Inventory',
      links: [{ href: '/platform/local-stock', label: 'Local Stock' }],
    });
  } else if (user.role !== 'admin') {
    // Quotes section - for non-wine partners, non-admins (admins get Quotes under Orders section)
    const quotesLinks = [
      { href: '/platform/quotes', label: 'Create Quote' },
      { href: '/platform/my-quotes', label: 'My Quotes' },
    ];
    sections.push({ title: 'Quotes', links: quotesLinks });
  }

  // Private Clients section - for Wine Partners
  if (isWinePartner) {
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
  if ((user.customerType === 'b2b' || user.partner?.type === 'distributor') && user.role !== 'admin') {
    sections.push({
      title: 'Private Clients',
      links: [
        { href: '/platform/distributor', label: 'Dashboard' },
        { href: '/platform/distributor/orders', label: 'Assigned Orders' },
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
        { href: '/platform/admin/private-orders', label: 'Private Orders' },
        { href: '/platform/admin/zoho-sales-orders', label: 'Zoho Sales' },
        { href: '/platform/admin/source', label: 'Source' },
        { href: '/platform/admin/logistics', label: 'Logistics' },
        { href: '/platform/admin/quote-approvals', label: 'Approvals' },
        { href: '/platform/quotes', label: 'Quotes' },
        { href: '/platform/my-quotes', label: 'My Quotes' },
      ],
    });
    sections.push({
      title: 'Warehouse',
      links: [
        { href: '/platform/admin/wms', label: 'WMS Dashboard' },
        { href: '/platform/admin/wms/receiving', label: 'Receiving' },
        { href: '/platform/admin/wms/pick', label: 'Pick' },
        { href: '/platform/admin/wms/dispatch', label: 'Dispatch' },
        { href: '/platform/admin/wms/labels', label: 'Labels' },
        { href: '/platform/admin/wms/movements', label: 'Movements' },
        { href: '/platform/admin/stock-explorer', label: 'Stock Explorer' },
        { href: '/platform/admin/wms/cycle-count', label: 'Cycle Count' },
      ],
    });
    sections.push({
      title: 'Partners',
      links: [
        { href: '/platform/admin/users', label: 'Users' },
        { href: '/platform/admin/partners', label: 'Distributors' },
        { href: '/platform/admin/wine-partners', label: 'Wine Partners' },
      ],
    });
    sections.push({
      title: 'Finance',
      links: [
        { href: '/platform/admin/commissions', label: 'Commissions' },
        { href: '/platform/admin/pricing', label: 'Pricing' },
        { href: '/platform/admin/pricing-calculator', label: 'Calculator' },
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

  // Support section - route to appropriate support page based on user type
  const isDistributor = user.customerType === 'b2b' || user.partner?.type === 'distributor';

  const getSupportHref = () => {
    if (isWinePartner) return '/platform/partner/support';
    if (isDistributor) return '/platform/distributor/support';
    return '/platform/support';
  };

  sections.push({
    title: 'Help',
    links: [{ href: getSupportHref(), label: 'Support' }],
  });

  return <MobileNav sections={sections} />;
};

export default PlatformMobileNav;
