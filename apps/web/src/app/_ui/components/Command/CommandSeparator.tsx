import { Command as CommandPrimitive } from 'cmdk';
import { VariantProps, tv } from 'tailwind-variants';

export const commandSeparatorStyles = tv({
  base: 'bg-border-primary -mx-1 h-px',
});

export interface CommandSeparatorProps
  extends VariantProps<typeof commandSeparatorStyles>,
    React.ComponentProps<typeof CommandPrimitive.Separator> {}

const CommandSeparator = ({
  children,
  className,
  ...props
}: CommandSeparatorProps) => {
  return (
    <CommandPrimitive.Separator
      className={commandSeparatorStyles({ className })}
      {...props}
    >
      {children}
    </CommandPrimitive.Separator>
  );
};

export default CommandSeparator;
