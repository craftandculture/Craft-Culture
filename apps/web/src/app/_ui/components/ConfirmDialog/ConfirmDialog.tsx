'use client';

import AlertDialog from '../AlertDialog/AlertDialog';
import AlertDialogAction from '../AlertDialog/AlertDialogAction';
import AlertDialogCancel from '../AlertDialog/AlertDialogCancel';
import AlertDialogContent from '../AlertDialog/AlertDialogContent';
import AlertDialogDescription from '../AlertDialog/AlertDialogDescription';
import AlertDialogFooter from '../AlertDialog/AlertDialogFooter';
import AlertDialogHeader from '../AlertDialog/AlertDialogHeader';
import AlertDialogTitle from '../AlertDialog/AlertDialogTitle';
import Button from '../Button/Button';
import ButtonContent from '../Button/ButtonContent';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  /** danger = a red confirm button for anything that removes or undoes work */
  tone?: 'default' | 'danger';
  onConfirm: () => void;
}

/**
 * An in-app replacement for window.confirm. Controlled: hold the pending
 * action in state, open the dialog, and run it from onConfirm.
 */
const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
}: ConfirmDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        {description && (
          <AlertDialogDescription>{description}</AlertDialogDescription>
        )}
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel asChild>
          <Button variant="outline" size="sm">
            <ButtonContent>{cancelLabel}</ButtonContent>
          </Button>
        </AlertDialogCancel>
        <AlertDialogAction asChild>
          <Button
            size="sm"
            colorRole={tone === 'danger' ? 'danger' : 'brand'}
            onClick={onConfirm}
          >
            <ButtonContent>{confirmLabel}</ButtonContent>
          </Button>
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default ConfirmDialog;
