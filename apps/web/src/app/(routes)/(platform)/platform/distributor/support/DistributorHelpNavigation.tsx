'use client';

import {
  IconBox,
  IconCreditCard,
  IconHelp,
  IconMail,
  IconRocket,
  IconTimeline,
  IconTruck,
  IconUserCheck,
} from '@tabler/icons-react';
import Link from 'next/link';

import Icon from '@/app/_ui/components/Icon/Icon';

const navItems = [
  { id: 'getting-started', label: 'Your Portal', icon: IconRocket },
  { id: 'verification', label: 'Client Verification', icon: IconUserCheck },
  { id: 'payment', label: 'Payment', icon: IconCreditCard },
  { id: 'order-lifecycle', label: 'Order Lifecycle', icon: IconTimeline },
  { id: 'fulfillment', label: 'Stock & Delivery', icon: IconTruck },
  { id: 'quantities', label: 'Cases & Bottles', icon: IconBox },
  { id: 'faq', label: 'FAQ', icon: IconHelp },
  { id: 'contact', label: 'Contact', icon: IconMail },
];

const DistributorHelpNavigation = () => {
  return (
    <nav className="sticky top-4 z-10 mb-8 overflow-x-auto rounded-lg border border-border-primary bg-fill-primary/95 p-2 backdrop-blur-sm">
      <div className="flex min-w-max gap-1">
        {navItems.map((item) => (
          <Link
            key={item.id}
            href={`#${item.id}`}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-fill-secondary hover:text-text-primary"
          >
            <Icon icon={item.icon} size="xs" className="shrink-0" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default DistributorHelpNavigation;
