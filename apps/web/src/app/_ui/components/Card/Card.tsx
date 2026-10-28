import { Slot } from '@radix-ui/react-slot';
import { VariantProps, tv } from 'tailwind-variants';

export const cardStyles = tv({
  base: 'relative overflow-hidden rounded-xl transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
  variants: {
    colorRole: {
      primary: 'border-border-primary bg-surface-primary',
      muted: 'border-border-muted bg-surface-muted',
      tertiary: 'border-border-tertiary bg-surface-tertiary',
      brand: 'text-surface-primary border-text-primary bg-text-primary',
    },
    variant: {
      ghost: null,
      outline: 'border border-b-2',
    },
    shadow: {
      none: null,
      sm: 'shadow-sm',
      md: 'shadow-md',
    },
    hover: {
      true: 'hover:shadow-md hover:border-border-primary-hover',
      false: null,
    },
  },
  defaultVariants: {
    colorRole: 'primary',
    variant: 'outline',
    // Tone and edge define a card on the stone canvas; a shadow made each one float
    shadow: 'none',
  },
});

export interface CardProps
  extends VariantProps<typeof cardStyles>,
    React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

const Card = ({
  colorRole,
  variant,
  shadow,
  hover,
  className,
  children,
  asChild,
  ...props
}: React.PropsWithChildren<CardProps>) => {
  const Component = asChild ? Slot : 'article';

  return (
    <Component
      className={cardStyles({ colorRole, variant, className, shadow, hover })}
      {...props}
    >
      {children}
    </Component>
  );
};

export default Card;
