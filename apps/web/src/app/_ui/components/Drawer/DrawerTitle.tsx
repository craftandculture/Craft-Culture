'use client';

import React from 'react';
import { VariantProps, tv } from 'tailwind-variants';
import { Drawer as DrawerPrimitive } from 'vaul';

const drawerTitleStyles = tv({
  base: 'text-lg font-semibold leading-none tracking-tight',
});

export interface DrawerTitleProps
  extends VariantProps<typeof drawerTitleStyles>,
    React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title> {}

const DrawerTitle = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Title>,
  React.PropsWithChildren<DrawerTitleProps>
>(({ className, children, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={drawerTitleStyles({ className })}
    {...props}
  >
    {children}
  </DrawerPrimitive.Title>
));

DrawerTitle.displayName = DrawerPrimitive.Title.displayName;


export default DrawerTitle;
