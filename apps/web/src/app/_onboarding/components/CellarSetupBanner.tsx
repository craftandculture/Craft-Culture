'use client';

import { IconArrowRight, IconId } from '@tabler/icons-react';
import Link from 'next/link';

export interface CellarSetupBannerProps {
  missing: string[];
}

/**
 * What a member still needs to add, as one slim line across the cellar
 *
 * The Emirates ID leads because it is what buying, releasing and bringing
 * wine in wait on; the rest only smooth deliveries.
 */
const CellarSetupBanner = ({ missing }: CellarSetupBannerProps) => {
  const needsId = missing.includes('Emirates ID');

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50/70 to-transparent p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/50 dark:from-amber-500/10">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100/80 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
          <IconId size={16} />
        </span>
        <div>
          <p className="text-text-primary text-sm font-semibold">Finish setting up</p>
          <p className="text-text-muted text-xs leading-5">
            {needsId
              ? 'Add your Emirates ID before you buy, sell, request a delivery or bring wine in.'
              : 'A few details so that deliveries go smoothly.'}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {missing.map((item, index) => (
          <Link
            key={item}
            href="/platform/cellar/profile"
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${
              index === 0
                ? 'bg-text-primary text-surface-primary'
                : 'border-border-muted bg-surface-primary text-text-primary border'
            }`}
          >
            Add {item.includes('ID') ? item : item.toLowerCase()}
            <IconArrowRight size={13} />
          </Link>
        ))}
      </div>
    </div>
  );
};

export default CellarSetupBanner;
