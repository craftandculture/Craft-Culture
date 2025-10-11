'use client';

import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';

import Typography, { TypographyProps } from '../Typography/Typography';

export interface AlertDialogDescriptionProps
  extends TypographyProps,
    React.ComponentProps<typeof AlertDialogPrimitive.Description> {}

const AlertDialogDescription = ({
  children,
  ...props
}: AlertDialogDescriptionProps) => (
  <Typography asChild variant="bodyMd" {...props}>
    <AlertDialogPrimitive.Description>
      {children}
    </AlertDialogPrimitive.Description>
  </Typography>
);

export default AlertDialogDescription;
