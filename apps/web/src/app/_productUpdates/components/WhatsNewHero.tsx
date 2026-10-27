import { IconStars } from '@tabler/icons-react';

export interface WhatsNewHeroProps {
  /** Updates published since the member's last visit */
  newCount: number;
  counts: { feature: number; improvement: number; fix: number };
}

/**
 * The heading What's New opens with: the same plain heading as every cellar
 * page, with what is new since the member's last visit in green
 */
const WhatsNewHero = ({ newCount }: WhatsNewHeroProps) => {
  return (
    <header className="mb-5">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.12em] text-emerald-700 uppercase dark:text-emerald-300">
        <IconStars size={14} />
        Updates
      </p>
      <h1 className="text-text-primary mt-1.5 text-2xl font-semibold tracking-tight">
        What&rsquo;s New in your Private Cellar
      </h1>
      <p className="text-text-muted mt-0.5 text-sm">
        Every improvement to your private cellar, in one place.
        {newCount > 0 && (
          <span className="font-semibold text-emerald-700 dark:text-emerald-300">
            {' '}
            {newCount} new since your last visit.
          </span>
        )}
      </p>
    </header>
  );
};

export default WhatsNewHero;
