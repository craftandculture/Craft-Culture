'use client';

import AlertDialog from '@/app/_ui/components/AlertDialog/AlertDialog';
import AlertDialogAction from '@/app/_ui/components/AlertDialog/AlertDialogAction';
import AlertDialogBody from '@/app/_ui/components/AlertDialog/AlertDialogBody';
import AlertDialogCancel from '@/app/_ui/components/AlertDialog/AlertDialogCancel';
import AlertDialogContent from '@/app/_ui/components/AlertDialog/AlertDialogContent';
import AlertDialogDescription from '@/app/_ui/components/AlertDialog/AlertDialogDescription';
import AlertDialogFooter from '@/app/_ui/components/AlertDialog/AlertDialogFooter';
import AlertDialogHeader from '@/app/_ui/components/AlertDialog/AlertDialogHeader';
import AlertDialogTitle from '@/app/_ui/components/AlertDialog/AlertDialogTitle';
import AlertDialogTrigger from '@/app/_ui/components/AlertDialog/AlertDialogTrigger';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';

export interface ConfirmActionProps {
  /** What is being committed, as a short question or statement */
  title: string;
  /** What happens next, in the member's or operator's terms */
  description: React.ReactNode;
  /** The committing button, e.g. "Accept and deliver" */
  confirmLabel: string;
  /** Destructive actions (withdraw, cancel, pause) read in red */
  tone?: 'default' | 'danger';
  onConfirm: () => void;
}

/**
 * A second step before an action that commits wine or money
 *
 * Wraps any trigger. Accepting a quote, ordering a condition report, confirming
 * a payment or pausing a membership each take effect at once, so one stray
 * click must not be enough.
 *
 * @example
 *   <ConfirmAction title="Accept this quote?" description="…" confirmLabel="Accept and deliver" onConfirm={accept}>
 *     <Button>Accept and deliver</Button>
 *   </ConfirmAction>
 */
const ConfirmAction = ({
  title,
  description,
  confirmLabel,
  tone = 'default',
  onConfirm,
  children,
}: React.PropsWithChildren<ConfirmActionProps>) => {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      {/*
        React events bubble through portals, so a click inside the dialog
        would otherwise reach a clickable row the trigger sits in.
      */}
      <AlertDialogContent onClick={(event) => event.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogBody>
          <AlertDialogDescription asChild>
            <div className="text-text-muted space-y-2 text-sm leading-relaxed">
              {description}
            </div>
          </AlertDialogDescription>
        </AlertDialogBody>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="ghost" size="sm">
              <ButtonContent>Go back</ButtonContent>
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              size="sm"
              onClick={onConfirm}
              className={
                tone === 'danger'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-neutral-900 text-white hover:bg-neutral-800'
              }
            >
              <ButtonContent>{confirmLabel}</ButtonContent>
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmAction;
