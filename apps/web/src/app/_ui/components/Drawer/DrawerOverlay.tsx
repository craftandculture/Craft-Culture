'use client';

import React from 'react';
import { VariantProps, tv } from 'tailwind-variants';
import { Drawer as DrawerPrimitive } from 'vaul';

const drawerOverlayStyles = tv({
  base: 'fixed inset-0 z-50 bg-black/25',
});

export interface DrawerOverlayProps
  extends VariantProps<typeof drawerOverlayStyles>,
    React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay> {}

const DrawerOverlay = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Overlay>,
  DrawerOverlayProps
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={drawerOverlayStyles({ className })}
    {...props}
  />
));

DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

export default DrawerOverlay;
