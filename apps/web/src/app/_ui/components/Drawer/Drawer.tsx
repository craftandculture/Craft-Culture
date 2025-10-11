'use client';

import React from 'react';
import { Drawer as DrawerPrimitive } from 'vaul';

export interface DrawerProps {
  shouldScaleBackground?: boolean;
}

type DrawerPropsWithPrimitive = DrawerProps &
  React.ComponentProps<typeof DrawerPrimitive.Root>;

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: DrawerPropsWithPrimitive) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    {...props}
  />
);

export default Drawer;
