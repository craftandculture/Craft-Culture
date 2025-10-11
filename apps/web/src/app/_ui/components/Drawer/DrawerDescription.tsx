'use client';

import React from 'react';
import { VariantProps, tv } from 'tailwind-variants';
import { Drawer as DrawerPrimitive } from 'vaul';

import Typography from '../Typography/Typography';

const drawerDescriptionStyles = tv({
  base: 'text-text-muted',
});

export interface DrawerDescriptionProps
  extends VariantProps<typeof drawerDescriptionStyles>,
    React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description> {}

const DrawerDescription = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Description>,
  React.PropsWithChildren<DrawerDescriptionProps>
>(({ className, children, ...props }, ref) => (
  <Typography
    asChild
    variant="bodyMd"
    colorRole="muted"
    className={drawerDescriptionStyles({ className })}
  >
    <DrawerPrimitive.Description ref={ref} {...props}>
      {children}
    </DrawerPrimitive.Description>
  </Typography>
));

DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export default DrawerDescription;
