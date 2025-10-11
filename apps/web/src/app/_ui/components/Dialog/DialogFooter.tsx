'use client';

import { VariantProps, tv } from 'tailwind-variants';

export const dialogFooterStyles = tv({
  base: 'border-border-muted bg-surface-muted flex shrink-0 items-center justify-end gap-2 rounded-b-lg border-t p-2',
});

export interface DialogFooterProps
  extends VariantProps<typeof dialogFooterStyles> {
  className?: string;
}

const DialogFooter = ({
  className,
  children,
  ...props
}: React.PropsWithChildren<DialogFooterProps>) => (
  <div className={dialogFooterStyles({ className, ...props })}>{children}</div>
);

export default DialogFooter;
