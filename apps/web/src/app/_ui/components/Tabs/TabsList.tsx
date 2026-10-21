'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import { VariantProps, tv } from 'tailwind-variants';

const tabsListStyles = tv({
  // Scrolls sideways rather than overflowing when the tabs outgrow a phone
  base: 'bg-fill-muted/25 text-text-muted inline-flex max-w-full items-center justify-start overflow-x-auto p-1 sm:justify-center',
  variants: {
    shape: {
      rect: 'rounded-xl',
      pill: 'rounded-full',
    },
  },
  defaultVariants: {
    shape: 'rect',
  },
});

export interface TabsListProps
  extends VariantProps<typeof tabsListStyles>,
    React.ComponentProps<typeof TabsPrimitive.List> {}

const TabsList = ({
  children,
  shape,
  className,
  ...props
}: React.PropsWithChildren<TabsListProps>) => {
  return (
    <TabsPrimitive.List
      className={tabsListStyles({ className, shape })}
      {...props}
    >
      {children}
    </TabsPrimitive.List>
  );
};

export default TabsList;
