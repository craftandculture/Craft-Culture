'use client';

import React from 'react';
import { VariantProps, tv } from 'tailwind-variants';

const drawerHeaderStyles = tv({
  base: 'grid gap-1.5 p-4 text-center sm:text-left',
});

export interface DrawerHeaderProps
  extends VariantProps<typeof drawerHeaderStyles>,
    React.HTMLAttributes<HTMLDivElement> {}

const DrawerHeader = ({
  className,
  children,
  ...props
}: React.PropsWithChildren<DrawerHeaderProps>) => (
  <div className={drawerHeaderStyles({ className })} {...props}>
    {children}
  </div>
);

DrawerHeader.displayName = 'DrawerHeader';

export default DrawerHeader;
