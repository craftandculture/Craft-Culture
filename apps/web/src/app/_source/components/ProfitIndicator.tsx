'use client';

import { IconArrowDown, IconArrowUp, IconMinus } from '@tabler/icons-react';
import { tv } from 'tailwind-variants';

import Typography from '@/app/_ui/components/Typography/Typography';

interface ProfitIndicatorProps {
  profitUsd: number | null;
  profitMarginPercent: number | null;
  isLosingItem?: boolean;
  size?: 'sm' | 'md';
  showAmount?: boolean;
}

const profitStyles = tv({
  base: 'flex items-center gap-1',
  variants: {
    type: {
      positive: 'text-text-success',
      negative: 'text-text-danger',
      neutral: 'text-text-muted',
    },
  },
});

/**
 * Display profit/margin indicator with color coding
 */
const ProfitIndicator = ({
  profitUsd,
  profitMarginPercent,
  isLosingItem,
  size = 'md',
  showAmount = true,
}: ProfitIndicatorProps) => {
  if (profitUsd === null || profitMarginPercent === null) {
    return (
      <div className={profitStyles({ type: 'neutral' })}>
        <IconMinus className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
        <Typography variant={size === 'sm' ? 'bodySm' : 'bodyMd'} colorRole="muted">
          TBC
        </Typography>
      </div>
    );
  }

  const type = isLosingItem || profitUsd < 0 ? 'negative' : profitUsd > 0 ? 'positive' : 'neutral';
  const Icon = type === 'positive' ? IconArrowUp : type === 'negative' ? IconArrowDown : IconMinus;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className={profitStyles({ type })}>
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      <Typography
        variant={size === 'sm' ? 'bodySm' : 'bodyMd'}
        className={
          type === 'positive'
            ? 'text-text-success'
            : type === 'negative'
              ? 'text-text-danger'
              : 'text-text-muted'
        }
      >
        {showAmount && `${formatCurrency(profitUsd)} `}
        ({profitMarginPercent.toFixed(1)}%)
      </Typography>
    </div>
  );
};

export default ProfitIndicator;
