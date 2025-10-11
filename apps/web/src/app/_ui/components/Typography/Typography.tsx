import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, tv } from 'tailwind-variants';

export const typographyStyles = tv({
  variants: {
    variant: {
      monoXs: 'font-mono text-xs leading-4',
      monoSm: 'font-mono text-sm leading-5',
      monoMd: 'font-mono text-base leading-6',
      bodyXs: 'text-xs font-medium leading-4 tracking-tight',
      bodySm: 'text-sm font-medium leading-6 tracking-tight',
      bodyMd: 'text-base font-medium leading-6 tracking-tight',
      bodyLg: 'text-lg font-medium leading-7 tracking-tight',
      bodyXl: 'text-xl font-medium leading-8',
      labelXs: 'text-xs font-medium leading-5 tracking-tight',
      labelSm: 'text-sm font-medium leading-5 tracking-tight',
      labelMd: 'text-base font-medium leading-6 tracking-tight',
      labelLg: 'text-lg font-medium leading-7 tracking-tight',
      labelXl: 'text-xl font-medium leading-8',
      headingXs: 'font-heading text-base font-medium leading-5 tracking-tight',
      headingSm: 'font-heading text-lg font-medium leading-6 tracking-tight',
      headingMd: 'font-heading text-xl font-medium leading-7 tracking-tight',
      headingLg: 'font-heading text-2xl font-medium leading-8 tracking-tight',
      displaySm:
        'font-display md:leading-12! text-2xl font-medium leading-8 tracking-tight md:text-5xl',
      displayMd:
        'font-display md:leading-13! text-3xl font-medium leading-10 tracking-tight md:text-6xl',
      displayLg:
        'font-display md:leading-14! text-4xl font-medium leading-10 tracking-tight md:text-7xl',
      displayXl:
        'font-display leading-13! md:leading-16! text-5xl font-medium tracking-tight md:text-8xl',
    },
    colorRole: {
      primary: 'text-text-primary',
      muted: 'text-text-muted',
      success: 'text-text-success',
      warning: 'text-text-warning',
      danger: 'text-text-danger',
      brand: 'text-text-brand',
      accentOrange: 'text-text-accent-orange',
    },
  },
  defaultVariants: {
    variant: 'labelMd',
  },
});

export interface TypographyProps extends VariantProps<typeof typographyStyles> {
  className?: string;
  asChild?: boolean;
}

const Typography = ({
  variant,
  colorRole,
  className,
  asChild,
  children,
  ...props
}: React.PropsWithChildren<TypographyProps> &
  React.HTMLAttributes<HTMLParagraphElement>) => {
  const Comp = asChild ? Slot : 'p';
  return (
    <Comp
      className={typographyStyles({ variant, colorRole, className })}
      {...props}
    >
      {children}
    </Comp>
  );
};

export default Typography;
