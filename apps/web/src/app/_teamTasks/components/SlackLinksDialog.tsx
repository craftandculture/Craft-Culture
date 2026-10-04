'use client';

import { useState } from 'react';

import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogBody from '@/app/_ui/components/Dialog/DialogBody';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogFooter from '@/app/_ui/components/Dialog/DialogFooter';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';

import useTaskMutations from '../hooks/useTaskMutations';
import type { Board } from '../types/Board';

/**
 * Admin only: link each person to their Slack account so #tasks can tag them
 *
 * The member ID is on each person's Slack profile: More (⋯), then Copy member
 * ID. It starts with U. Left blank, posts show the name without a tag.
 */
const SlackLinksDialog = ({ board, open, onOpenChange }: { board: Board; open: boolean; onOpenChange: (o: boolean) => void }) => {
  const { setSlackIds } = useTaskMutations();
  const [ids, setIds] = useState<Record<string, string>>(
    Object.fromEntries(board.team.filter((m) => !m.partnerId).map((m) => [m.id, m.slackMemberId ?? ''])),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Slack accounts</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <p className="text-sm text-text-muted">
            Paste each person&apos;s Slack member ID so #tasks can tag them. In Slack, open their profile, press the
            three dots, then Copy member ID.
          </p>
          {board.team.filter((m) => !m.partnerId).map((m) => (
            <label key={m.id} className="flex items-center gap-3 text-sm text-text-primary">
              <span className="w-32 shrink-0 truncate">{m.name}</span>
              <input
                className="h-9 flex-1 rounded-lg border border-border-primary bg-surface-primary px-2.5 font-mono text-sm"
                value={ids[m.id] ?? ''}
                onChange={(e) => setIds((s) => ({ ...s, [m.id]: e.target.value.trim() }))}
                placeholder="U0123ABCD"
              />
            </label>
          ))}
        </DialogBody>
        <DialogFooter>
          <div className="flex w-full justify-end">
            <button
              type="button"
              disabled={setSlackIds.isPending}
              onClick={() =>
                setSlackIds.mutate(
                  Object.entries(ids).map(([userId, slackMemberId]) => ({ userId, slackMemberId })),
                  { onSuccess: () => onOpenChange(false) },
                )
              }
              className="h-9 rounded-lg border border-border-brand bg-fill-brand px-4 text-sm font-medium text-text-brand-on-fill disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SlackLinksDialog;
