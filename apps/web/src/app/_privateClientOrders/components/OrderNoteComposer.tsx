'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Checkbox from '@/app/_ui/components/Checkbox/Checkbox';
import TextArea from '@/app/_ui/components/TextArea/TextArea';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import { PCO_NOTE_MAX_LENGTH } from '../constants';

export interface OrderNoteComposerProps {
  /** Which side is writing — decides the route and whether 'internal' exists */
  audience: 'admin' | 'partner' | 'distributor';
  orderId: string;
  /** The order's parties, named in the "who sees this" hint */
  partnerName?: string | null;
  distributorName?: string | null;
}

/**
 * Leave a note on a PCO for the other parties
 *
 * The note lands on the order's timeline, which partner, distributor and C&C
 * all read, and the other sides are told. C&C can keep a note to itself.
 */
const OrderNoteComposer = ({
  audience,
  orderId,
  partnerName,
  distributorName,
}: OrderNoteComposerProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [note, setNote] = useState('');
  const [internal, setInternal] = useState(false);

  const onSaved = {
    onSuccess: () => {
      toast.success(internal ? 'Internal note added' : 'Note added and shared');
      setNote('');
      setInternal(false);
      void queryClient.invalidateQueries({
        queryKey:
          audience === 'admin'
            ? api.privateClientOrders.adminGetOne.queryKey()
            : audience === 'partner'
              ? api.privateClientOrders.getOne.queryKey()
              : api.privateClientOrders.distributorGetOne.queryKey(),
      });
    },
    onError: (error: { message: string }) => toast.error(error.message),
  };

  const adminAdd = useMutation(api.privateClientOrders.adminAddNote.mutationOptions(onSaved));
  const partnerAdd = useMutation(api.privateClientOrders.addNote.mutationOptions(onSaved));
  const distributorAdd = useMutation(
    api.privateClientOrders.distributorAddNote.mutationOptions(onSaved),
  );
  const isPending = adminAdd.isPending || partnerAdd.isPending || distributorAdd.isPending;

  const submit = () => {
    const text = note.trim();
    if (!text) return;
    if (audience === 'admin') adminAdd.mutate({ orderId, note: text, internal });
    else if (audience === 'partner') partnerAdd.mutate({ orderId, note: text });
    else distributorAdd.mutate({ orderId, note: text });
  };

  const parties = [partnerName, distributorName, 'Craft & Culture'].filter(Boolean);
  const hint = internal
    ? 'Only Craft & Culture will see this note.'
    : `Visible to ${parties.slice(0, -1).join(', ')}${parties.length > 1 ? ' and ' : ''}${parties.at(-1)}. They’ll be notified.`;

  return (
    <div className="mb-4 flex flex-col gap-2">
      <TextArea
        rows={2}
        placeholder="Add a note for everyone on this order…"
        value={note}
        maxLength={PCO_NOTE_MAX_LENGTH}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          {audience === 'admin' && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-text-primary">
              <Checkbox
                checked={internal}
                onCheckedChange={(checked) => setInternal(checked === true)}
              />
              Internal — C&amp;C only
            </label>
          )}
          <Typography variant="bodyXs" colorRole="muted">
            {hint}
          </Typography>
        </div>
        <Button size="sm" onClick={submit} disabled={isPending || !note.trim()}>
          {isPending ? 'Adding…' : 'Add note'}
        </Button>
      </div>
    </div>
  );
};

export default OrderNoteComposer;
