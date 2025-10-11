'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { VariantProps, tv } from 'tailwind-variants';

import Typography from '../Typography/Typography';

export const dropdownMenuItemStyles = tv({
  base: 'outline-hidden data-disabled:pointer-events-none data-disabled:opacity-50 bg-fill-primary hover:bg-fill-primary-hover active:bg-fill-primary-active relative flex cursor-pointer select-none items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
  variants: {
    colorRole: {
      primary: 'text-text-primary',
      danger: 'text-text-danger',
    },
    inset: {
      true: 'pl-8',
    },
    size: {
      md: 'min-h-9',
      lg: 'min-h-10',
    },
    isDisabled: {
      true: 'pointer-events-none opacity-50',
    },
  },
  defaultVariants: {
    colorRole: 'primary',
    inset: false,
    size: 'md',
  },
});

export interface DropdownMenuItemProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.Item>,
    VariantProps<typeof dropdownMenuItemStyles> {}

const DropdownMenuItem = ({
  className,
  colorRole,
  inset,
  size,
  children,
  isDisabled,
  ...props
}: DropdownMenuItemProps) => (
  <Typography asChild variant="bodySm">
    <DropdownMenuPrimitive.Item
      className={dropdownMenuItemStyles({
        colorRole,
        inset,
        size,
        className,
        isDisabled,
      })}
      disabled={isDisabled}
      {...props}
    >
      {children}
    </DropdownMenuPrimitive.Item>
  </Typography>
);

export default DropdownMenuItem;
