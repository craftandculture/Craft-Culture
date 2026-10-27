'use client';

import { IconCheck, IconDots, IconEdit, IconTrash, IconUser, IconX } from '@tabler/icons-react';
import { useState } from 'react';

import AlertDialog from '@/app/_ui/components/AlertDialog/AlertDialog';
import AlertDialogAction from '@/app/_ui/components/AlertDialog/AlertDialogAction';
import AlertDialogCancel from '@/app/_ui/components/AlertDialog/AlertDialogCancel';
import AlertDialogContent from '@/app/_ui/components/AlertDialog/AlertDialogContent';
import AlertDialogDescription from '@/app/_ui/components/AlertDialog/AlertDialogDescription';
import AlertDialogFooter from '@/app/_ui/components/AlertDialog/AlertDialogFooter';
import AlertDialogHeader from '@/app/_ui/components/AlertDialog/AlertDialogHeader';
import AlertDialogTitle from '@/app/_ui/components/AlertDialog/AlertDialogTitle';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import DropdownMenu from '@/app/_ui/components/DropdownMenu/DropdownMenu';
import DropdownMenuContent from '@/app/_ui/components/DropdownMenu/DropdownMenuContent';
import DropdownMenuItem from '@/app/_ui/components/DropdownMenu/DropdownMenuItem';
import DropdownMenuSeparator from '@/app/_ui/components/DropdownMenu/DropdownMenuSeparator';
import DropdownMenuTrigger from '@/app/_ui/components/DropdownMenu/DropdownMenuTrigger';

export interface PartnerRowActionsProps {
  name: string;
  status: string;
  /** What the partner is called on this screen: "partner", "collector", "distributor" */
  noun: string;
  isBusy?: boolean;
  onEdit: () => void;
  onSetStatus: (status: 'active' | 'inactive') => void;
  onDelete: () => void;
  /** Offered on wine partners only: reclassify instead of recreating */
  makeCollector?: { onConfirm: () => void };
}

type Pending = 'deactivate' | 'delete' | 'collector' | null;

/**
 * Edit, plus everything else behind a ⋯ menu, each with a confirmation
 *
 * Every card used to carry a solid red Deactivate and a red bin side by side,
 * and Deactivate took effect on the first tap — with no confirmation — on the
 * account that a partner's whole portal hangs off. Edit stays in view because
 * it is the common action; the rest are rare and each one now asks first.
 */
const PartnerRowActions = ({
  name,
  status,
  noun,
  isBusy,
  onEdit,
  onSetStatus,
  onDelete,
  makeCollector,
}: PartnerRowActionsProps) => {
  const [pending, setPending] = useState<Pending>(null);
  const isActive = status === 'active';

  const confirm = {
    deactivate: {
      title: `Deactivate ${name}?`,
      body: `Their users can no longer act for this ${noun}. Nothing is deleted, and you can activate them again at any time.`,
      action: 'Deactivate',
      danger: true,
      run: () => onSetStatus('inactive'),
    },
    delete: {
      title: `Delete ${name}?`,
      body: `This permanently removes the ${noun} and all of its user memberships. To take them offline but keep the record, deactivate instead.`,
      action: `Delete ${noun}`,
      danger: true,
      run: onDelete,
    },
    collector: {
      title: `Reclassify ${name} as a private collector?`,
      body: 'They move to the Collectors tab and see only their own cellar — sourcing, RFQs and private-client orders are withdrawn. All stock stays with them: it is held against this partner record, not against the type.',
      action: 'Make collector',
      danger: false,
      run: () => makeCollector?.onConfirm(),
    },
  };
  const open = pending ? confirm[pending] : null;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {!isActive && (
        <Button size="sm" variant="outline" onClick={() => onSetStatus('active')} isDisabled={isBusy}>
          <ButtonContent iconLeft={IconCheck}>Activate</ButtonContent>
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={onEdit}>
        <ButtonContent iconLeft={IconEdit}>Edit</ButtonContent>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`More for ${name}`}
            disabled={isBusy}
            className="flex size-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-primary-hover hover:text-text-primary disabled:opacity-50"
          >
            <IconDots className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {makeCollector && (
            <DropdownMenuItem onSelect={() => setPending('collector')}>
              <IconUser className="size-4" /> Make collector
            </DropdownMenuItem>
          )}
          {isActive && (
            <DropdownMenuItem onSelect={() => setPending('deactivate')}>
              <IconX className="size-4" /> Deactivate
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem colorRole="danger" onSelect={() => setPending('delete')}>
            <IconTrash className="size-4" /> Delete {noun}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!open} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{open?.title}</AlertDialogTitle>
            <AlertDialogDescription>{open?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => open?.run()}
              className={open?.danger ? 'bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700' : undefined}
            >
              {open?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PartnerRowActions;
