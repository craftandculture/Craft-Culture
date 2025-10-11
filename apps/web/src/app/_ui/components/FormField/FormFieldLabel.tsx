import { Slot } from '@radix-ui/react-slot';
import { VariantProps, tv } from 'tailwind-variants';

import Typography, { TypographyProps } from '../Typography/Typography';

const formFieldLabelStyles = tv({
  base: 'cursor-pointer',
  variants: {
    isDisabled: {
      true: 'text-text-muted cursor-not-allowed',
    },
  },
});

export interface FormFieldLabelProps
  extends React.HTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof formFieldLabelStyles>,
    TypographyProps {
  asChild?: boolean;
}

const FormFieldLabel = ({
  className,
  variant = 'labelSm',
  colorRole,
  isDisabled,
  asChild,
  children,
  ...props
}: React.PropsWithChildren<FormFieldLabelProps>) => {
  const Comp = asChild ? Slot : 'label';
  return (
    <Typography
      variant={variant}
      className={formFieldLabelStyles({ className, isDisabled })}
      asChild
      colorRole={colorRole}
    >
      <Comp {...props}>{children}</Comp>
    </Typography>
  );
};

export default FormFieldLabel;
