import { IconAlertCircle } from '@tabler/icons-react';
import { VariantProps, tv } from 'tailwind-variants';

import Icon from '../Icon/Icon';
import Typography, { TypographyProps } from '../Typography/Typography';

const formFieldErrorStyles = tv({
  slots: {
    wrapper: 'text-text-danger flex items-center gap-1',
    icon: '-translate-y-px',
  },
});

export interface FormFieldErrorProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof formFieldErrorStyles>,
    Omit<TypographyProps, 'asChild'> {}

const { wrapper, icon } = formFieldErrorStyles();

const FormFieldError = ({
  className,
  children,
  ...props
}: FormFieldErrorProps) => {
  return (
    <Typography variant="bodySm" className={wrapper({ className })} {...props}>
      <Icon icon={IconAlertCircle} className={icon()} />
      {children}
    </Typography>
  );
};

export default FormFieldError;
