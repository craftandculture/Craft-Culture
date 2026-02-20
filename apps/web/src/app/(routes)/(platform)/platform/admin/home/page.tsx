import {
  IconBolt,
  IconBuildingWarehouse,
  IconCoin,
  IconPackage,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';

import type { IconProp } from '@/app/_ui/components/Icon/Icon';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

interface SectionCard {
  title: string;
  description: string;
  href: string;
  icon: IconProp;
}

const sections: SectionCard[] = [
  {
    title: 'Orders',
    description: 'Private orders, Zoho sales, sourcing, logistics',
    href: '/platform/admin/private-orders',
    icon: IconPackage,
  },
  {
    title: 'Warehouse',
    description: 'WMS operations, stock explorer, cycle counts',
    href: '/platform/admin/wms',
    icon: IconBuildingWarehouse,
  },
  {
    title: 'Partners',
    description: 'Users, distributors, wine partners',
    href: '/platform/admin/users',
    icon: IconUsers,
  },
  {
    title: 'Finance',
    description: 'Commissions, pricing, calculator',
    href: '/platform/admin/commissions',
    icon: IconCoin,
  },
  {
    title: 'Agents',
    description: 'AI agents and intelligence tools',
    href: '/platform/admin/agents',
    icon: IconBolt,
  },
  {
    title: 'System',
    description: 'Activity logs, imports, settings',
    href: '/platform/admin/settings',
    icon: IconSettings,
  },
];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

/** Admin home dashboard — v1 with section navigation cards */
const AdminHomePage = () => {
  return (
    <div className="container py-8">
      <div className="mb-8">
        <Typography variant="headingLg">{getGreeting()}</Typography>
        <Typography variant="bodySm" className="mt-1 text-text-muted">
          Navigate to a section to get started.
        </Typography>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group flex items-start gap-4 rounded-xl border border-border-muted bg-white p-5 transition-all hover:border-fill-brand/30 hover:shadow-sm dark:bg-background-secondary"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fill-brand/10">
              <Icon icon={section.icon} size="lg" className="text-text-brand" />
            </div>
            <div>
              <Typography variant="bodySm" className="font-semibold group-hover:text-text-brand">
                {section.title}
              </Typography>
              <Typography variant="bodyXs" className="mt-0.5 text-text-muted">
                {section.description}
              </Typography>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdminHomePage;
