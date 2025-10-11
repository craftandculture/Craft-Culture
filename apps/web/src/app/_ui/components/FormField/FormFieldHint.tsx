import Typography, { TypographyProps } from '../Typography/Typography';

export interface FormFieldHintProps extends TypographyProps {}

const FormFieldHint = ({
  children,
  ...props
}: React.PropsWithChildren<FormFieldHintProps>) => {
  return (
    <Typography variant="bodyXs" className="mt-1" colorRole="muted" {...props}>
      {children}
    </Typography>
  );
};

export default FormFieldHint;
