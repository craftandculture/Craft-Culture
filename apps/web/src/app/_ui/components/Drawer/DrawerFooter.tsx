'use client';

import React from 'react';
import { VariantProps, tv } from 'tailwind-variants';

const drawerFooterStyles = tv({
  base: 'mt-auto flex flex-col gap-2 p-4',
});

export interface DrawerFooterProps
  extends VariantProps<typeof drawerFooterStyles>,
    React.HTMLAttributes<HTMLDivElement> {}

const DrawerFooter = ({
  className,
  children,
  ...props
}: React.PropsWithChildren<DrawerFooterProps>) => (
  <div className={drawerFooterStyles({ className })} {...props}>
    {children}
  </div>
);

DrawerFooter.displayName = 'DrawerFooter';

export default DrawerFooter;
