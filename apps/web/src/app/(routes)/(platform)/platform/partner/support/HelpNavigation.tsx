'use client';

import {
  IconBox,
  IconCreditCard,
  IconHelp,
  IconMail,
  IconPackage,
  IconRocket,
  IconShoppingCart,
  IconTimeline,
} from '@tabler/icons-react';

import Icon from '@/app/_ui/components/Icon/Icon';

const navItems = [
  { id: 'getting-started', label: 'Getting Started', icon: IconRocket },
  { id: 'creating-orders', label: 'Creating Orders', icon: IconShoppingCart },
  { id: 'order-lifecycle', label: 'Order Lifecycle', icon: IconTimeline },
  { id: 'inventory', label: 'Inventory', icon: IconBox },
  { id: 'pricing', label: 'Pricing', icon: IconCreditCard },
  { id: 'products', label: 'Products', icon: IconPackage },
  { id: 'faq', label: 'FAQ', icon: IconHelp },
  { id: 'contact', label: 'Contact', icon: IconMail },
];

/**
 * Sticky navigation bar for quick jumping to partner help sections
 */
const HelpNavigation = () => {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="sticky top-16 z-10 -mx-4 mb-6 overflow-x-auto border-b border-border-primary bg-background-primary/95 px-4 py-3 backdrop-blur-sm sm:mx-0 sm:rounded-lg sm:border sm:px-2">
      <div className="flex items-center gap-1 sm:justify-center">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => scrollToSection(item.id)}
            className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-fill-secondary hover:text-text-primary sm:px-3 sm:py-2 sm:text-sm"
          >
            <Icon icon={item.icon} size="xs" className="hidden sm:block" />
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default HelpNavigation;
