'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { IconChevronRight } from '@tabler/icons-react';
import { VariantProps, tv } from 'tailwind-variants';

import Icon from '../Icon/Icon';
import Typography from '../Typography/Typography';

export const dropdownMenuSubTriggerStyles = tv({
  slots: {
    wrapper:
      'outline-hidden bg-fill-primary hover:bg-fill-primary-hover focus:bg-fill-primary-hover data-[state=open]:bg-fill-primary-active flex cursor-pointer select-none items-center gap-1.5 rounded-lg px-2.5 py-1.5',
    chevron: 'ml-auto',
  },
  variants: {
    inset: {
      true: { wrapper: 'pl-8' },
    },
    size: {
      md: { wrapper: 'h-9' },
      lg: { wrapper: 'h-10' },
    },
  },
  defaultVariants: {
    inset: false,
    size: 'md',
  },
});

export interface DropdownMenuSubTriggerProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger>,
    VariantProps<typeof dropdownMenuSubTriggerStyles> {}

const { wrapper, chevron } = dropdownMenuSubTriggerStyles();

const DropdownMenuSubTrigger = ({
  className,
  inset,
  size,
  children,
  ...props
}: DropdownMenuSubTriggerProps) => (
  <Typography asChild variant="bodySm">
    <DropdownMenuPrimitive.SubTrigger
      className={wrapper({ inset, className, size })}
      {...props}
    >
      {children}
      <Icon icon={IconChevronRight} className={chevron()} colorRole="muted" />
    </DropdownMenuPrimitive.SubTrigger>
  </Typography>
);

export default DropdownMenuSubTrigger;
