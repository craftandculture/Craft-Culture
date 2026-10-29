import Link from 'next/link';

export interface FirstStepsCardProps {
  /** Small label above the title */
  eyebrow: string;
  title: string;
  message: string;
  /** Three steps, in the order they happen */
  steps: {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    title: string;
    text: string;
  }[];
  action: { href: string; label: string };
}

/**
 * An empty tab that invites the member in, with how it works in three steps
 *
 * Shown where a member has not yet done the thing a tab is for, such as a
 * first delivery or a first sale. It says what happens, in order, and gives
 * one place to begin, so an empty page reads as an invitation, not a gap.
 */
const FirstStepsCard = ({ eyebrow, title, message, steps, action }: FirstStepsCardProps) => {
  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/80 to-transparent px-5 py-7 sm:px-8 sm:py-9 dark:border-emerald-900/40 dark:from-emerald-500/[0.07]">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold tracking-[0.14em] text-emerald-700 uppercase dark:text-emerald-300">
          {eyebrow}
        </p>
        <h2 className="text-text-primary mt-2 text-xl font-semibold tracking-tight text-balance sm:text-2xl">
          {title}
        </h2>
        <p className="text-text-muted mx-auto mt-1.5 max-w-xl text-sm">{message}</p>
      </div>

      <ol className="relative mx-auto mt-7 grid max-w-4xl gap-3 sm:grid-cols-3">
        {/* The line the three steps sit on, from the first to the last */}
        <span
          aria-hidden
          className="absolute top-[38px] right-[16%] left-[16%] hidden h-px bg-emerald-200 sm:block dark:bg-emerald-900/60"
        />
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="bg-surface-primary relative flex flex-col items-center rounded-xl border border-black/[0.06] px-4 pt-5 pb-5 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
          >
            <span className="relative grid size-11 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <step.icon size={20} />
              <span className="absolute -top-1 -left-1 grid size-5 place-items-center rounded-full bg-surface-primary text-[10px] font-semibold text-text-muted ring-1 ring-border-muted">
                {index + 1}
              </span>
            </span>
            <span className="text-text-primary mt-3 text-sm font-semibold">{step.title}</span>
            <span className="text-text-muted mt-1 text-xs leading-relaxed">{step.text}</span>
          </li>
        ))}
      </ol>

      <div className="mt-7 flex justify-center">
        <Link
          href={action.href}
          className="inline-flex h-11 items-center text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
        >
          {action.label}
        </Link>
      </div>
    </section>
  );
};

export default FirstStepsCard;
