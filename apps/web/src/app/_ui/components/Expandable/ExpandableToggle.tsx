'use client';

import { Slot } from '@radix-ui/react-slot';

import { useExpandable } from './hooks/useExpandable';

export type ExpandableToggleProps = {
  asChild?: boolean;
  className?: string;
};

const ExpandableToggle = ({
  children,
  asChild,
  className,
}: React.PropsWithChildren<ExpandableToggleProps>) => {
  const { toggleExpanded, isExpandable, isExpanded } = useExpandable();

  const Comp = asChild ? Slot : 'button';

  if (!isExpandable) return null;

  return (
    <Comp
      onClick={toggleExpanded}
      className={className}
      data-expandable={isExpandable}
      data-expanded={isExpanded}
    >
      {children}
    </Comp>
  );
};

export default ExpandableToggle;
