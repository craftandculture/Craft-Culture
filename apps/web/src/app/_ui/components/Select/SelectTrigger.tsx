'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { IconChevronDown } from '@tabler/icons-react';
import { forwardRef } from 'react';

import { cn } from '@/lib/utils/cn';

export interface SelectTriggerProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> {}

/**
 * SelectTrigger component with default styling
 *
 * Wraps Radix UI Select.Trigger with consistent input-like styling
 */
const SelectTrigger = forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-9 w-full items-center justify-between rounded-lg border border-b-2 border-border-primary bg-fill-primary px-2.5 text-sm font-medium text-text-primary ring-2 ring-transparent transition-all duration-200',
      'hover:border-border-primary-hover focus:outline-none focus:ring-border-primary',
      'disabled:cursor-not-allowed disabled:opacity-50',
      '[&>span]:line-clamp-1',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <IconChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));

SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export default SelectTrigger;
