'use client';

import * as SheetPrimitive from '@radix-ui/react-dialog';
import { VariantProps, tv } from 'tailwind-variants';

import SheetOverlay from './SheetOverlay';
import SheetPortal from './SheetPortal';

export const sheetContentStyles = tv({
  base: 'border-border-primary bg-surface-primary data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 gap-4 transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-300',
  variants: {
    side: {
      left: 'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
      right:
        'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
    },
  },
  defaultVariants: {
    side: 'left',
  },
});

export interface SheetContentProps
  extends VariantProps<typeof sheetContentStyles>,
    React.ComponentProps<typeof SheetPrimitive.Content> {
  preventClosing?: boolean;
}

const SheetContent = ({
  className,
  children,
  preventClosing = false,
  side = 'left',
  ...props
}: SheetContentProps) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      className={sheetContentStyles({ className, side })}
      {...props}
      onPointerDownOutside={(event) => {
        if (preventClosing) {
          event.preventDefault();
        }
        props.onPointerDownOutside?.(event);
      }}
      onInteractOutside={(event) => {
        if (preventClosing) {
          event.preventDefault();
        }
        props.onInteractOutside?.(event);
      }}
    >
      {children}
    </SheetPrimitive.Content>
  </SheetPortal>
);

export default SheetContent;
