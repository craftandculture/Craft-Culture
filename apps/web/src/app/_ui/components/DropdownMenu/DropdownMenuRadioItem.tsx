'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { IconCheck } from '@tabler/icons-react';
import { VariantProps, tv } from 'tailwind-variants';

import Icon from '../Icon/Icon';
import Typography from '../Typography/Typography';

export const dropdownMenuRadioItemStyles = tv({
  slots: {
    wrapper:
      'outline-hidden data-disabled:pointer-events-none data-disabled:opacity-50 bg-fill-primary hover:bg-fill-primary-hover focus:bg-fill-primary-hover focus:text-text-primary active:bg-fill-primary-active relative flex cursor-pointer select-none items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors',
    indicatorWrapper: 'flex size-3.5 items-center justify-center',
  },
  variants: {
    size: {
      md: { wrapper: 'h-9' },
      lg: { wrapper: 'h-10' },
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export interface DropdownMenuRadioItemProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>,
    VariantProps<typeof dropdownMenuRadioItemStyles> {}

const { wrapper, indicatorWrapper } = dropdownMenuRadioItemStyles();

const DropdownMenuRadioItem = ({
  className,
  children,
  size,
  ...props
}: DropdownMenuRadioItemProps) => (
  <Typography variant="bodySm" asChild>
    <DropdownMenuPrimitive.RadioItem
      className={wrapper({ className, size })}
      {...props}
    >
      {children}
      <DropdownMenuPrimitive.ItemIndicator>
        <span className={indicatorWrapper()}>
          <Icon colorRole="muted" icon={IconCheck} />
        </span>
      </DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.RadioItem>
  </Typography>
);

export default DropdownMenuRadioItem;
