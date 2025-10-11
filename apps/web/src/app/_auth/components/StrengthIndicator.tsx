import { VariantProps, tv } from 'tailwind-variants';

export const strengthIndicatorStyles = tv({
  slots: {
    wrapper: 'bg-fill-muted relative h-1.5 w-20 rounded',
    indicator: 'absolute left-0 top-0 h-full rounded transition-all',
  },
  variants: {
    strength: {
      0: {
        indicator: 'bg-fill-danger w-0',
      },
      1: {
        indicator: 'bg-fill-danger w-1/4',
      },
      2: {
        indicator: 'bg-fill-warning w-1/2',
      },
      3: {
        indicator: 'bg-fill-success w-3/4',
      },
      4: {
        indicator: 'bg-fill-success w-full',
      },
    },
  },
  defaultVariants: {
    strength: 0,
  },
});

export interface StrengthIndicatorProps
  extends VariantProps<typeof strengthIndicatorStyles> {
  className?: string;
}

const { wrapper, indicator } = strengthIndicatorStyles();

const StrengthIndicator = ({ className, strength }: StrengthIndicatorProps) => {
  return (
    <div className={wrapper({ className })}>
      <div className={indicator({ strength })} />
    </div>
  );
};

export default StrengthIndicator;
