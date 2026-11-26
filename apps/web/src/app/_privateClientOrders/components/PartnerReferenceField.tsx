'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

export interface PartnerReferenceFieldProps {
  orderId: string;
  value: string | null | undefined;
  /** Called after a save, to refresh the order */
  onSaved: () => void;
}

/**
 * The partner's own reference for an order, editable at any stage
 *
 * Partners often raise their own sales order after the PCO is placed. The
 * reference comes back on the stock API's sale events, so their system can
 * match each sale to their order.
 */
const PartnerReferenceField = ({ orderId, value, onSaved }: PartnerReferenceFieldProps) => {
  const api = useTRPC();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  const save = useMutation(
    api.privateClientOrders.setPartnerReference.mutationOptions({
      onSuccess: (result) => {
        toast.success(result.changed ? 'Reference saved' : 'Nothing changed');
        setEditing(false);
        onSaved();
      },
      onError: (error) => toast.error(error.message || 'The reference could not be saved'),
    }),
  );

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <Typography variant="labelSm" colorRole="muted">
          Your reference
        </Typography>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(value ?? '');
              setEditing(true);
            }}
            className="text-text-muted hover:text-text-primary rounded px-1.5 py-0.5 text-xs font-medium"
          >
            {value ? 'Edit' : 'Add'}
          </button>
        )}
      </div>
      {editing ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate({ orderId, partnerReference: draft.trim() });
          }}
        >
          <input
            id={`partner-reference-${orderId}`}
            value={draft}
            maxLength={100}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="For example your sales order number"
            className="border-border-muted bg-background-primary w-56 rounded-md border px-2 py-1 text-sm"
            aria-label="Your reference"
          />
          <button
            type="submit"
            disabled={save.isPending}
            className="bg-text-primary text-background-primary rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-40"
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-text-muted text-xs underline">
            Cancel
          </button>
        </form>
      ) : (
        <Typography variant="bodySm" colorRole={value ? undefined : 'muted'}>
          {value || 'None yet'}
        </Typography>
      )}
    </div>
  );
};

export default PartnerReferenceField;
