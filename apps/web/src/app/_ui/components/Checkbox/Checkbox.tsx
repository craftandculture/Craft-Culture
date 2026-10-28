'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { IconCheck, IconMinus } from '@tabler/icons-react';
import { VariantProps, tv } from 'tailwind-variants';

import Icon from '../Icon/Icon';

export const checkboxStyles = tv({
  slots: {
    checkbox:
      'hover:border-border-primary-hover data-[state=checked]:hover:border-text-primary focus-visible:outline-hidden data-[state=checked]:text-surface-primary border-border-primary bg-fill-primary ring-offset-border-primary focus-visible:ring-border-primary data-[state=checked]:bg-text-primary data-[state=indeterminate]:bg-text-primary data-[state=indeterminate]:text-surface-primary data-[state=indeterminate]:hover:border-text-primary peer static flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-sm border transition-all focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-transparent data-[state=indeterminate]:border-transparent',
    indicator:
      'group flex items-center justify-center overflow-hidden text-current',
  },
  variants: {
    isDisabled: {
      true: { checkbox: 'opacity-50' },
    },
  },
});

const { checkbox, indicator } = checkboxStyles();

export interface CheckboxProps
  extends VariantProps<typeof checkboxStyles>,
    React.ComponentProps<typeof CheckboxPrimitive.Root> {
  isDisabled?: boolean;
}

const Checkbox = ({
  className,
  isDisabled,
  ...props
}: React.PropsWithChildren<CheckboxProps>) => (
  <CheckboxPrimitive.Root
    className={checkbox({ className, isDisabled })}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={indicator()}>
      <Icon
        icon={IconCheck}
        className="hidden group-data-[state=checked]:block group-data-[state=indeterminate]:hidden"
      />
      <Icon
        icon={IconMinus}
        className="hidden group-data-[state=indeterminate]:block group-data-[state=checked]:hidden"
      />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
);

export default Checkbox;
