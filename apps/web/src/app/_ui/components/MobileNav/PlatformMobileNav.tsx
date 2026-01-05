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

  // Quotes section - always shown
  const quotesLinks = [
    { href: '/platform/quotes', label: 'Create Quote' },
    { href: '/platform/my-quotes', label: 'My Quotes' },
  ];
  if (user.role === 'admin') {
    quotesLinks.push({ href: '/platform/admin/quote-approvals', label: 'Approvals' });
  }
  sections.push({ title: 'Quotes', links: quotesLinks });

  // Private Clients section - for Wine Partners
  if (user.customerType === 'private_clients' && user.partner?.type === 'wine_partner') {
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

  // Admin sections
  if (user.role === 'admin') {
    sections.push({
      title: 'Private Orders',
      links: [
        { href: '/platform/admin', label: 'Dashboard' },
        { href: '/platform/admin/private-orders', label: 'Manage Orders' },
      ],
    });
    sections.push({
      title: 'Pricing',
      links: [{ href: '/platform/admin/pricing-calculator', label: 'Calculator' }],
    });
    sections.push({
      title: 'Admin',
      links: [
        { href: '/platform/admin/users', label: 'Users' },
        { href: '/platform/admin/partners', label: 'Distributors' },
        { href: '/platform/admin/wine-partners', label: 'Wine Partners' },
      ],
    });
  }

  // Support section - route to appropriate support page based on user type
  const isWinePartner =
    user.customerType === 'private_clients' && user.partner?.type === 'wine_partner';
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
