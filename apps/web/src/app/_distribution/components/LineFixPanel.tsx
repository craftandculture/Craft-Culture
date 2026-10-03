'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import LinkWinePicker from './LinkWinePicker';

export interface LineFixPanelProps {
  outletId: string;
  outletCode: string;
  /** Our wine's full LWIN; without it only re-linking is offered */
  lwin: string | null;
  productName: string;
  owners: { id: string; name: string }[];
  ownerChip: (name: string) => string;
  onDone: () => void;
  onCancel: () => void;
}

/**
 * Settle a line that is linked to a wine but reaches no invoice of ours
 *
 * Two things can be wrong, and the panel offers both. Usually the wine went to
 * the outlet on an invoice that named no owner, so it needs saying whose it
 * is — written as the per-wine owner, which the invoice read honours too.
 * Sometimes the link itself is wrong, and the answer is a different wine.
 */
const LineFixPanel = ({
  outletId,
  outletCode,
  lwin,
  productName,
  owners,
  ownerChip,
  onDone,
  onCancel,
}: LineFixPanelProps) => {
  const api = useTRPC();
  const [relink, setRelink] = useState(!lwin);

  const setOwner = useMutation({
    ...api.distribution.admin.setWineOwner.mutationOptions(),
    onSuccess: () => {
      toast.success(`Owner set for ${productName}`);
      onDone();
    },
    onError: (error) => toast.error(error.message),
  });

  if (relink) {
    return (
      <LinkWinePicker
        outletId={outletId}
        outletCode={outletCode}
        productName={productName}
        onLinked={onDone}
        onCancel={lwin ? () => setRelink(false) : onCancel}
      />
    );
  }

  return (
    <div className="border-border-brand bg-fill-brand/5 space-y-2 rounded-lg border p-3 text-sm">
      <p className="text-text-primary">
        Linked to one of our wines, but no invoice of ours to the outlet carries it, so it has no owner or price.
        Whose is it?
      </p>
      <div className="flex flex-wrap gap-2">
        {owners.map((owner) => (
          <button
            key={owner.id}
            type="button"
            disabled={setOwner.isPending}
            onClick={() =>
              lwin && setOwner.mutate({ outletId, lwin18: lwin, ownerId: owner.id, productName })
            }
            className={`rounded-full px-3 py-1 text-xs font-medium ${ownerChip(owner.name)}`}
          >
            {owner.name}
          </button>
        ))}
      </div>
      <p className="text-text-muted text-xs">
        It stays unvalued until it appears on an invoice to the outlet.{' '}
        <button type="button" onClick={() => setRelink(true)} className="text-text-brand font-medium hover:underline">
          Linked to the wrong wine? Re-link
        </button>{' '}
        ·{' '}
        <button type="button" onClick={onCancel} className="hover:underline">
          Cancel
        </button>
      </p>
    </div>
  );
};

export default LineFixPanel;
