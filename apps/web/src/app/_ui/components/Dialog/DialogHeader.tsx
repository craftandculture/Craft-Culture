'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { IconX } from '@tabler/icons-react';
import { VariantProps, tv } from 'tailwind-variants';

import Button from '../Button/Button';
import ButtonContent from '../Button/ButtonContent';
import Icon from '../Icon/Icon';

export const dialogHeaderStyles = tv({
  slots: {
    wrapper:
      'border-border-muted flex min-h-12 shrink-0 items-center justify-between border-b px-4 py-3',
    content: 'flex min-w-0 grow flex-col gap-0.5',
    close: 'shrink-0 self-start',
  },
});

export interface DialogHeaderProps
  extends VariantProps<typeof dialogHeaderStyles> {
  className?: string;
  showCloseButton?: boolean;
}

const { wrapper, content, close } = dialogHeaderStyles();

const DialogHeader = ({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.PropsWithChildren<DialogHeaderProps>) => (
  <header className={wrapper({ className, ...props })}>
    <div className={content()}>{children}</div>
    {showCloseButton && (
      <Button
        size="sm"
        asChild
        variant="ghost"
        shape="circle"
        className={close()}
      >
        <DialogPrimitive.Close>
          <ButtonContent>
            <Icon icon={IconX} colorRole="muted" />
            <span className="sr-only">Close</span>
          </ButtonContent>
        </DialogPrimitive.Close>
      </Button>
    )}
  </header>
);

export default DialogHeader;
