import { type VariantProps, tv } from 'tailwind-variants';

export const statusPillStyles = tv({
  slots: {
    pill: 'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
    dot: 'size-1.5 shrink-0 rounded-full',
  },
  variants: {
    tone: {
      success: {
        pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
        dot: 'bg-emerald-500',
      },
      warning: {
        pill: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
        dot: 'bg-amber-500',
      },
      danger: {
        pill: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30',
        dot: 'bg-red-500',
      },
      info: {
        pill: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30',
        dot: 'bg-blue-500',
      },
      neutral: {
        pill: 'bg-surface-muted text-text-secondary ring-border-muted',
        dot: 'bg-text-muted',
      },
    },
  },
  defaultVariants: {
    tone: 'neutral',
  },
});

export type StatusPillTone = NonNullable<
  VariantProps<typeof statusPillStyles>['tone']
>;

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillStyles> {
  /** Show a small coloured dot before the label */
  dot?: boolean;
}

/** A rounded status label in the house style, readable in light and dark mode */
const StatusPill = ({
  tone,
  dot,
  className,
  children,
  ...props
}: React.PropsWithChildren<StatusPillProps>) => {
  const styles = statusPillStyles({ tone });

  return (
    <span className={styles.pill({ className })} {...props}>
      {dot && <span className={styles.dot()} aria-hidden="true" />}
      {children}
    </span>
  );
};

export default StatusPill;
