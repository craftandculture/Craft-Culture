'use client';

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { AnimatePresence, motion } from 'motion/react';
import { VariantProps, tv } from 'tailwind-variants';

import { useCollapsible } from './Collapsible';

export const collapsibleContentStyles = tv({
  base: 'outline-hidden text-text-primary',
});

export interface CollapsibleContentProps
  extends CollapsiblePrimitive.CollapsibleContentProps,
    VariantProps<typeof collapsibleContentStyles> {}

const CollapsibleContent = ({
  className,
  children,
  ...props
}: CollapsibleContentProps) => {
  const { isOpen } = useCollapsible();

  return (
    <CollapsiblePrimitive.CollapsibleContent
      className={collapsibleContentStyles({ className })}
      forceMount
      {...props}
    >
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            layout
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: 0.2,
              ease: [0.4, 0, 0.2, 1],
              layout: { duration: 0.2 },
            }}
            style={{ overflow: 'hidden' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </CollapsiblePrimitive.CollapsibleContent>
  );
};

export default CollapsibleContent;
