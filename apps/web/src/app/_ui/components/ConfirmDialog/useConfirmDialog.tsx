'use client';

import { useCallback, useRef, useState } from 'react';

import ConfirmDialog, { type ConfirmDialogProps } from './ConfirmDialog';

export type ConfirmOptions = Pick<
  ConfirmDialogProps,
  'title' | 'description' | 'confirmLabel' | 'cancelLabel' | 'tone'
>;

/**
 * Promise-based ConfirmDialog, for swapping out window.confirm with the
 * least change to the calling code:
 *
 *   const { confirm, confirmDialog } = useConfirmDialog();
 *   if (!(await confirm({ title: 'Remove this line?', tone: 'danger' }))) return;
 *   ...
 *   return <>{...}{confirmDialog}</>;
 */
const useConfirmDialog = () => {
  // Options stay set after closing so the text does not vanish mid-animation
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOpen(false);
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => {
    // A second request replaces the first; the first resolves as cancelled
    resolverRef.current?.(false);
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const confirmDialog = (
    <ConfirmDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) settle(false);
      }}
      title={options?.title ?? ''}
      description={options?.description}
      confirmLabel={options?.confirmLabel}
      cancelLabel={options?.cancelLabel}
      tone={options?.tone}
      onConfirm={() => settle(true)}
    />
  );

  return { confirm, confirmDialog };
};

export default useConfirmDialog;
