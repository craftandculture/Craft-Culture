'use client';

import React from 'react';
import { VariantProps, tv } from 'tailwind-variants';
import { Drawer as DrawerPrimitive } from 'vaul';

const drawerContentStyles = tv({
  base: 'bg-surface-primary border-border-primary fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-lg border border-t-2 px-4 pb-4',
});

export interface DrawerContentProps
  extends VariantProps<typeof drawerContentStyles>,
    React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> {}

const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Content>,
  React.PropsWithChildren<DrawerContentProps>
>(({ className, children, ...props }, ref) => (
  <DrawerPrimitive.Content
    ref={ref}
    className={drawerContentStyles({ className })}
    {...props}
  >
    <div className="bg-fill-muted mx-auto mt-4 h-2 w-[100px] rounded-full" />
    {children}
  </DrawerPrimitive.Content>
));

DrawerContent.displayName = 'DrawerContent';

export default DrawerContent;
