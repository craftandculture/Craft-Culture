'use client';

import {
  IconBuildingWarehouse,
  IconHelp,
  IconPlaneDeparture,
  IconShip,
  IconTruckDelivery,
} from '@tabler/icons-react';

import Icon from '@/app/_ui/components/Icon/Icon';

const navItems = [
  { id: 'storing', label: 'Storing wine', icon: IconBuildingWarehouse },
  { id: 'shipping-in', label: 'Shipping in', icon: IconShip },
  { id: 'releasing', label: 'Releasing', icon: IconTruckDelivery },
  { id: 'exporting', label: 'Exporting', icon: IconPlaneDeparture },
  { id: 'faq', label: 'Questions', icon: IconHelp },
];

/**
 * Section navigation for the partner help centre
 */
const PartnerHelpNavigation = () => {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="border-border-primary bg-background-primary/95 sticky top-16 z-10 -mx-4 mb-6 overflow-x-auto border-b px-4 py-3 backdrop-blur-sm sm:mx-0 sm:rounded-lg sm:border sm:px-2">
      <div className="flex items-center gap-1 sm:justify-center">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => scrollToSection(item.id)}
            className="text-text-muted hover:bg-fill-secondary hover:text-text-primary flex flex-shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
          >
            <Icon icon={item.icon} size="xs" />
            <span className="whitespace-nowrap">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default PartnerHelpNavigation;
