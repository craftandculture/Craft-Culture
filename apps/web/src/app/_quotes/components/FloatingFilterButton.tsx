'use client';

import { IconFilter } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogBody from '@/app/_ui/components/Dialog/DialogBody';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Icon from '@/app/_ui/components/Icon/Icon';

import ProductFilters from './ProductFilters';
import type { ProductsGetFilterOptionsOutput } from '../../_products/controller/productsGetFilterOptions';

export interface FloatingFilterButtonProps {
  filterOptions: ProductsGetFilterOptionsOutput;
}

/**
 * Floating action button that opens filters in a dialog
 *
 * @example
 *   <FloatingFilterButton filterOptions={filterOptions} />
 */
const FloatingFilterButton = ({
  filterOptions,
}: FloatingFilterButtonProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show button when scrolled down 200px
      setIsVisible(window.scrollY > 200);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Floating Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-fill-accent shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl ${
          isVisible
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-4 opacity-0'
        }`}
        aria-label="Open filters"
      >
        <Icon icon={IconFilter} size="md" className="text-text-primary" />
      </button>

      {/* Dialog with Filters */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Product Filters</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <ProductFilters
              countriesWithCounts={filterOptions.countriesWithCounts}
              regionsByCountryWithCounts={
                filterOptions.regionsByCountryWithCounts
              }
              producersByCountryWithCounts={
                filterOptions.producersByCountryWithCounts
              }
              vintagesByCountryWithCounts={
                filterOptions.vintagesByCountryWithCounts
              }
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FloatingFilterButton;
