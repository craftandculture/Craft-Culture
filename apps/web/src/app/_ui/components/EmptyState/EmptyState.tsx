import { tv } from 'tailwind-variants';

import Icon, { type IconProp } from '../Icon/Icon';

export const emptyStateStyles = tv({
  slots: {
    wrapper: 'flex flex-col items-center justify-center px-4 text-center',
    iconTile:
      'mb-3 flex size-10 items-center justify-center rounded-full bg-fill-muted',
    title: 'text-sm font-medium text-text-primary',
    description: 'mt-1 max-w-sm text-sm text-text-muted',
    actionWrapper: 'mt-4 flex flex-wrap items-center justify-center gap-2',
  },
  variants: {
    size: {
      sm: { wrapper: 'py-6' },
      md: { wrapper: 'py-12' },
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export interface EmptyStateProps {
  icon?: IconProp;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** A button or link, e.g. "Clear filters" */
  action?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

/** The house empty state: a muted icon, one plain sentence, and an optional way out */
const EmptyState = ({
  icon,
  title,
  description,
  action,
  size,
  className,
}: EmptyStateProps) => {
  const styles = emptyStateStyles({ size });

  return (
    <div className={styles.wrapper({ className })}>
      {icon && (
        <div className={styles.iconTile()} aria-hidden="true">
          <Icon icon={icon} colorRole="muted" size="lg" />
        </div>
      )}
      <p className={styles.title()}>{title}</p>
      {description && <p className={styles.description()}>{description}</p>}
      {action && <div className={styles.actionWrapper()}>{action}</div>}
    </div>
  );
};

export default EmptyState;
