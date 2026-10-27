import {
  IconBinoculars,
  IconBottle,
  IconBuildingWarehouse,
  IconCoin,
  IconDatabaseSearch,
  IconHome2,
  IconListCheck,
  IconPackage,
  IconSettings,
  IconShip,
  IconUsers,
} from '@tabler/icons-react';

import type { IconProp } from '@/app/_ui/components/Icon/Icon';

export interface AdminNavLink {
  label: string;
  href: string;
  /** Shown to C&C staff only, not every admin: see _distribution/utils/isStaff */
  staffOnly?: boolean;
  /** Other pages that belong under this tab, such as a request opened from the quotes list */
  alsoMatches?: string[];
}

export interface AdminNavSection {
  key: string;
  label: string;
  href: string;
  icon: IconProp;
  /** Shown as an item in the desktop top bar; settings is reached by the gear */
  inTopNav: boolean;
  /** WMS operators see this section */
  forOperators: boolean;
  /** When set, the only pages of this section a WMS operator sees */
  operatorHrefs?: string[];
  /** The section's tabs; empty when the section is a single page */
  links: AdminNavLink[];
}

/**
 * The admin menu, defined once
 *
 * The desktop top bar, the section tabs under it and the phone menu all read
 * this. Each used to carry its own copy, and the phone menu had drifted eight
 * pages behind the desktop one.
 *
 * Retired from the menu in October 2026, unused all year: My Quotes,
 * Commissions, Freight Bills and Quote Approvals (the original Quote Tool's
 * review queue). The pages still open from a direct link.
 */
const adminNav: AdminNavSection[] = [
  { key: 'home', label: 'Home', href: '/platform/admin/home', icon: IconHome2, inTopNav: true, forOperators: false, links: [] },
  { key: 'tasks', label: 'Tasks', href: '/platform/admin/tasks', icon: IconListCheck, inTopNav: true, forOperators: true, links: [] },
  {
    key: 'orders',
    label: 'Orders',
    href: '/platform/admin',
    icon: IconPackage,
    inTopNav: true,
    forOperators: true,
    operatorHrefs: ['/platform/admin/private-orders'],
    links: [
      { label: 'Overview', href: '/platform/admin' },
      { label: 'Private Orders', href: '/platform/admin/private-orders' },
      { label: 'Zoho Sales', href: '/platform/admin/zoho-sales-orders' },
      { label: 'Order Check', href: '/platform/admin/order-check' },
      { label: 'Zoho Codes', href: '/platform/admin/zoho-codes' },
      { label: 'Source', href: '/platform/admin/source' },
      { label: 'Order Emails', href: '/platform/admin/order-emails', staffOnly: true },
    ],
  },
  {
    key: 'logistics',
    label: 'Logistics',
    href: '/platform/admin/logistics',
    icon: IconShip,
    inTopNav: true,
    forOperators: false,
    links: [
      { label: 'Dashboard', href: '/platform/admin/logistics' },
      { label: 'Shipments', href: '/platform/admin/logistics/shipments' },
      { label: 'Exports', href: '/platform/admin/logistics/exports' },
      { label: 'Export Invoices', href: '/platform/admin/logistics/export-invoices' },
      { label: 'Freight Quotes', href: '/platform/admin/logistics/quotes', alsoMatches: ['/platform/admin/logistics/requests', '/platform/admin/logistics/forwarders'] },
      { label: 'Reports', href: '/platform/admin/logistics/reports' },
    ],
  },
  { key: 'stock', label: 'Stock', href: '/platform/admin/stock-explorer', icon: IconDatabaseSearch, inTopNav: true, forOperators: true, links: [] },
  {
    key: 'warehouse',
    label: 'Warehouse',
    href: '/platform/admin/wms',
    icon: IconBuildingWarehouse,
    inTopNav: true,
    forOperators: true,
    links: [
      { label: 'Dashboard', href: '/platform/admin/wms' },
      { label: 'Receiving', href: '/platform/admin/wms/receive' },
      { label: 'Pick', href: '/platform/admin/wms/pick' },
      { label: 'Dispatch', href: '/platform/admin/wms/dispatch' },
      { label: 'Labels', href: '/platform/admin/wms/labels' },
      { label: 'Movements', href: '/platform/admin/wms/movements' },
      { label: 'Cycle Count', href: '/platform/admin/wms/cycle-count' },
    ],
  },
  {
    key: 'partners',
    label: 'Partners',
    href: '/platform/admin/users',
    icon: IconUsers,
    inTopNav: true,
    forOperators: false,
    links: [
      { label: 'Users', href: '/platform/admin/users' },
      { label: 'Clients', href: '/platform/admin/clients' },
      { label: 'Distributors', href: '/platform/admin/partners' },
      { label: 'Wine Partners', href: '/platform/admin/wine-partners' },
      { label: 'Collectors', href: '/platform/admin/collectors' },
    ],
  },
  /*
    The Private Cellar programme is run day to day as its own thing, and as
    eight more tabs under Partners it made a thirteen-tab bar that ran off the
    edge of a laptop screen with Member Updates and Member Emails out of sight.
  */
  {
    key: 'cellar',
    label: 'Cellar',
    href: '/platform/admin/cellar-members',
    icon: IconBottle,
    inTopNav: true,
    forOperators: false,
    links: [
      { label: 'Members', href: '/platform/admin/cellar-members' },
      { label: 'Consignment', href: '/platform/admin/consignment' },
      { label: 'Purchases', href: '/platform/admin/cellar-purchases' },
      { label: 'Releases', href: '/platform/admin/cellar-releases' },
      { label: 'Payouts', href: '/platform/admin/payouts' },
      // The page holds the UK bond tariff and the payment accounts, not release prices
      { label: 'Rates & Accounts', href: '/platform/admin/cellar-rates' },
      { label: 'Updates', href: '/platform/admin/member-updates', staffOnly: true },
      { label: 'Emails', href: '/platform/admin/member-emails', staffOnly: true },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    // Opens on the screen used daily; Commissions (B2C reps) has been empty for months
    href: '/platform/admin/pricing-manager',
    icon: IconCoin,
    inTopNav: true,
    forOperators: false,
    links: [
      { label: 'Pricing Manager', href: '/platform/admin/pricing-manager' },
      { label: 'Daily Sales', href: '/platform/admin/daily-sales', staffOnly: true },
      { label: 'Distribution', href: '/platform/admin/distribution' },
      { label: 'Quote Builder', href: '/platform/admin/quote-builder' },
      { label: 'Client LPOs', href: '/platform/admin/lpo' },
      // Triangulation stays until Crurated's figures agree in both
      { label: 'Triangulation', href: '/platform/admin/triangulation' },
      { label: 'Wine Labs', href: '/platform/admin/wine-labs', staffOnly: true },
      { label: 'Pricing Settings', href: '/platform/admin/pricing' },
      { label: 'Calculator', href: '/platform/admin/pricing-calculator' },
    ],
  },
  {
    key: 'agents',
    label: 'Intelligence',
    href: '/platform/admin/agents',
    icon: IconBinoculars,
    inTopNav: true,
    forOperators: false,
    links: [{ label: 'Dashboard', href: '/platform/admin/agents' }],
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '/platform/admin/settings',
    icon: IconSettings,
    inTopNav: false,
    forOperators: false,
    links: [
      { label: 'Activity', href: '/platform/admin/activity' },
      { label: 'Zoho Import', href: '/platform/admin/zoho-import' },
      { label: 'Settings', href: '/platform/admin/settings' },
    ],
  },
];

/**
 * The admin menu as this person may see it
 *
 * @param role - The user's role; `wms_operator` sees a reduced menu
 * @param isStaff - C&C staff, for the pages only they may see
 */
export const visibleAdminNav = ({ role, isStaff = false }: { role?: string; isStaff?: boolean }) =>
  adminNav
    .filter((section) => role !== 'wms_operator' || section.forOperators)
    .map((section) => ({
      ...section,
      links: section.links.filter(
        (link) =>
          (!link.staffOnly || isStaff) &&
          (role !== 'wms_operator' || !section.operatorHrefs || section.operatorHrefs.includes(link.href)),
      ),
    }));

/**
 * Of these links, the one the page is on: the longest whose path the page sits
 * under, so /wms/receive lights Receiving and not the WMS Dashboard as well.
 * `/platform/admin` is matched only exactly, since every admin page sits under it.
 */
export const activeHref = (pathname: string, hrefs: string[]) =>
  hrefs
    .filter((href) => pathname === href || (href !== '/platform/admin' && pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0] ?? null;

/**
 * The section a page belongs to: the one owning the closest matching page,
 * so every page in the menu lights its own section and shows its tabs.
 * Pages in no section fall back to Home.
 */
export const sectionForPath = (pathname: string) => {
  const owners = adminNav.flatMap((section) =>
    [section.href, ...section.links.map((link) => link.href)].map((href) => ({ href, key: section.key })),
  );
  const href = activeHref(pathname, owners.map((owner) => owner.href));

  return owners.find((owner) => owner.href === href)?.key ?? 'home';
};

export default adminNav;
