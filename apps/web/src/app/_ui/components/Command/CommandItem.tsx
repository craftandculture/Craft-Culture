import { Command as CommandPrimitive } from 'cmdk';
import { VariantProps, tv } from 'tailwind-variants';

export const commandItemStyles = tv({
  base: 'data-[selected=true]:bg-fill-primary-hover data-[selected=true]:text-text-primary relative flex cursor-default select-none items-center rounded-lg text-sm outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
  variants: {
    size: {
      sm: 'min-h-9 px-2 py-1',
      md: 'min-h-10 px-2.5 py-1.5',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export interface CommandItemProps
  extends VariantProps<typeof commandItemStyles>,
    React.ComponentProps<typeof CommandPrimitive.Item> {}

const CommandItem = ({
  children,
  className,
  size = 'md',
  ...props
}: CommandItemProps) => {
  return (
    <CommandPrimitive.Item
      className={commandItemStyles({ className, size })}
      {...props}
    >
      {children}
    </CommandPrimitive.Item>
  );
};

export default CommandItem;
