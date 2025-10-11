'use client';

import {
  Collapsible as CollapsiblePrimitive,
  CollapsibleProps as CollapsiblePrimitiveProps,
} from '@radix-ui/react-collapsible';
import { createContext, useContext, useState } from 'react';

interface CollapsibleContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CollapsibleContext = createContext<CollapsibleContextType | undefined>(
  undefined,
);

export const useCollapsible = () => {
  const context = useContext(CollapsibleContext);
  if (!context) {
    throw new Error(
      'useCollapsible must be used within a Collapsible component',
    );
  }
  return context;
};

interface CollapsibleProps extends CollapsiblePrimitiveProps {}

const Collapsible = ({
  children,
  open,
  onOpenChange,
  defaultOpen,
  ...props
}: React.PropsWithChildren<CollapsibleProps>) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  return (
    <CollapsibleContext.Provider
      value={{ isOpen, setIsOpen: handleOpenChange }}
    >
      <CollapsiblePrimitive
        open={isOpen}
        onOpenChange={handleOpenChange}
        {...props}
      >
        {children}
      </CollapsiblePrimitive>
    </CollapsibleContext.Provider>
  );
};

export default Collapsible;
