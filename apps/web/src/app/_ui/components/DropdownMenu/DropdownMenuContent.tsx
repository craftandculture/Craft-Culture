'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { VariantProps, tv } from 'tailwind-variants';

export const dropdownMenuContentStyles = tv({
  base: 'min-w-(--radix-dropdown-menu-trigger-width) border-border-primary bg-surface-primary text-text-primary data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 overflow-hidden rounded-lg border border-b-2 p-1',
});

export interface DropdownMenuContentProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.Content>,
    VariantProps<typeof dropdownMenuContentStyles> {}

const DropdownMenuContent = ({
  className,
  sideOffset = 6,
  collisionPadding = 8,
  ...props
}: DropdownMenuContentProps) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      className={dropdownMenuContentStyles({ className })}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
);

export default DropdownMenuContent;
