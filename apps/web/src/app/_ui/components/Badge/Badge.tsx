import { VariantProps, tv } from 'tailwind-variants';

export const badgeStyles = tv({
  base: 'focus:outline-hidden focus:ring-border-primary inline-flex items-center rounded-full border text-xs transition-colors focus:ring-2 focus:ring-offset-2',
  variants: {
    colorRole: {
      primary: 'border-border-primary bg-fill-primary',
      muted: 'border-border-primary bg-fill-muted/50 text-text-primary',
      info: 'border-border-info/10 bg-fill-info/10 text-text-info',
      brand: 'border-border-brand/10 bg-fill-brand/10 text-text-brand',
      success: 'border-border-success/10 bg-fill-success/10 text-text-success',
      danger: 'border-border-danger/10 bg-fill-danger/10 text-text-danger',
      warning: 'border-border-warning/10 bg-fill-warning/10 text-text-warning',
    },
    size: {
      xs: 'h-5 px-1.5',
      sm: 'h-6 px-2',
      md: 'h-7 px-2.5 text-sm',
    },
  },
  defaultVariants: {
    colorRole: 'primary',
    size: 'md',
  },
});

export interface BadgeProps
  extends React.HtmlHTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeStyles> {}

const Badge = ({ className, colorRole, size, ...props }: BadgeProps) => {
  return (
    <span className={badgeStyles({ className, colorRole, size })} {...props} />
  );
};

export default Badge;
