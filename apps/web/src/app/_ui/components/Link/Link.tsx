import { type VariantProps, tv } from 'tailwind-variants';

import SearchAwareLink, {
  SearchAwareLinkProps,
} from '../SearchAwareLink/SearchAwareLink';
import Typography, { type TypographyProps } from '../Typography/Typography';

export const linkStyles = tv({
  base: 'inline-flex align-top underline-offset-4 hover:underline',
  variants: {
    colorRole: {
      primary:
        'text-text-primary hover:text-text-primary-hover active:text-text-primary-active decoration-border-primary hover:decoration-border-primary-hover active:decoration-border-primary-active',
      muted: 'text-text-muted',
      brand: 'text-text-brand',
      success: 'text-text-success',
      danger: 'text-text-danger',
      warning: 'text-text-warning',
    },
    showUnderline: {
      true: 'underline',
      false: 'no-underline',
    },
    isDisabled: {
      true: 'pointer-events-none opacity-50',
    },
  },
  defaultVariants: {
    showUnderline: false,
  },
});

export interface LinkProps
  extends VariantProps<typeof linkStyles>,
    Omit<TypographyProps, 'colorRole' | 'asChild'>,
    SearchAwareLinkProps {
  className?: string;
}

const Link = ({
  variant,
  colorRole,
  showUnderline,
  className,
  isDisabled,
  children,
  ...props
}: React.PropsWithChildren<LinkProps>) => {
  return (
    <Typography
      asChild
      className={linkStyles({
        colorRole,
        showUnderline,
        className,
        isDisabled,
      })}
      aria-disabled={isDisabled}
      variant={variant}
    >
      <SearchAwareLink {...props}>{children}</SearchAwareLink>
    </Typography>
  );
};

export default Link;
