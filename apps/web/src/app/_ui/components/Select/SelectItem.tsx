'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { VariantProps, tv } from 'tailwind-variants';

import Typography from '../Typography/Typography';

export const selectItemStyles = tv({
  base: 'outline-hidden data-disabled:pointer-events-none data-disabled:opacity-50 focus:bg-fill-primary focus:text-text-primary relative flex cursor-pointer select-none items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:brightness-95 data-[highlighted]:brightness-95',
  variants: {
    size: {
      md: 'min-h-9',
      lg: 'min-h-10',
    },
    isDisabled: {
      true: 'pointer-events-none opacity-50',
    },
  },
  defaultVariants: {
    size: 'lg',
  },
});

export interface SelectItemProps
  extends React.ComponentProps<typeof SelectPrimitive.Item>,
    VariantProps<typeof selectItemStyles> {}

const SelectItem = ({
  className,
  size,
  children,
  isDisabled,
  ...props
}: SelectItemProps) => (
  <Typography asChild variant="bodySm">
    <SelectPrimitive.Item
      className={selectItemStyles({ size, className, isDisabled })}
      disabled={isDisabled}
      {...props}
    >
      {children}
    </SelectPrimitive.Item>
  </Typography>
);

export default SelectItem;
