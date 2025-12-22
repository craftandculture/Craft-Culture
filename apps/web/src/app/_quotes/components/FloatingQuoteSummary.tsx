'use client';

import { IconArrowUp, IconShoppingCart } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import formatPrice from '@/utils/formatPrice';

interface FloatingQuoteSummaryProps {
  itemCount: number;
  totalUsd: number;
  displayCurrency: 'USD' | 'AED';
  isLoading?: boolean;
  onReviewClick: () => void;
}

/**
 * Floating summary bar that appears when scrolling through the catalogue
 * Shows item count, total, and quick action to review quote
 *
 * @example
 *   <FloatingQuoteSummary
 *     itemCount={3}
 *     totalUsd={1500}
 *     displayCurrency="USD"
 *     onReviewClick={() => scrollToTop()}
 *   />
 */
const FloatingQuoteSummary = ({
  itemCount,
  totalUsd,
  displayCurrency,
  isLoading = false,
  onReviewClick,
}: FloatingQuoteSummaryProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show when scrolled past 400px and there are items in the quote
      const shouldShow = window.scrollY > 400 && itemCount > 0;
      setIsVisible(shouldShow);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state

    return () => window.removeEventListener('scroll', handleScroll);
  }, [itemCount]);

  const displayTotal =
    displayCurrency === 'AED' ? totalUsd * 3.67 : totalUsd;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transform transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-full opacity-0'
      }`}
    >
      <div className="border-t border-border-muted bg-surface-primary/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="container flex items-center justify-between gap-4 py-3 md:py-4">
          {/* Quote Summary */}
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-fill-brand/10">
              <IconShoppingCart className="h-5 w-5 text-text-brand" />
            </div>
            <div className="flex flex-col">
              <Typography variant="bodySm" className="font-semibold">
                {itemCount} {itemCount === 1 ? 'item' : 'items'} in quote
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                {isLoading ? (
                  'Calculating...'
                ) : (
                  <>Total: {formatPrice(displayTotal, displayCurrency)}</>
                )}
              </Typography>
            </div>
          </div>

          {/* Review Button */}
          <Button
            type="button"
            size="sm"
            colorRole="primary"
            onClick={onReviewClick}
            className="shrink-0"
          >
            <ButtonContent iconLeft={IconArrowUp}>
              <span className="hidden sm:inline">Review Quote</span>
              <span className="sm:hidden">Review</span>
            </ButtonContent>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FloatingQuoteSummary;
