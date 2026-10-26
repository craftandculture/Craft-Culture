import { IconStars } from '@tabler/icons-react';

export interface WhatsNewHeroProps {
  /** Updates published since the member's last visit */
  newCount: number;
  counts: { feature: number; improvement: number; fix: number };
}

/**
 * The dark band What's New opens with
 *
 * Near-black with the C&C greens, as on the Private Cellar sign-up, so the
 * page reads as an occasion rather than another white list.
 */
const WhatsNewHero = ({ newCount, counts }: WhatsNewHeroProps) => {
  const tallies = [
    { label: 'new features', value: counts.feature },
    { label: 'improvements', value: counts.improvement },
    { label: 'fixes', value: counts.fix },
  ];

  return (
    <header className="relative mb-6 overflow-hidden rounded-2xl bg-neutral-950 px-5 py-7 text-white sm:px-8 sm:py-9 dark:border dark:border-emerald-500/20 dark:bg-emerald-950/40">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-emerald-500/20 blur-3xl"
      />
      <p className="relative flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-emerald-300 uppercase">
        <IconStars size={15} />
        Updates
      </p>
      <h1 className="relative mt-3 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        What&rsquo;s New in your Private Cellar
      </h1>
      <p className="relative mt-2 max-w-xl text-sm text-white/70 sm:text-base">
        Every improvement to your private cellar, in one place.
        {newCount > 0 && (
          <span className="font-semibold text-emerald-300"> {newCount} new since your last visit.</span>
        )}
      </p>
      <dl className="relative mt-6 flex flex-wrap gap-x-8 gap-y-3">
        {tallies.map((tally) => (
          <div key={tally.label} className="flex items-baseline gap-2">
            <dt className="sr-only">{tally.label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{tally.value}</dd>
            <span className="text-sm text-white/60">{tally.label}</span>
          </div>
        ))}
      </dl>
    </header>
  );
};

export default WhatsNewHero;
