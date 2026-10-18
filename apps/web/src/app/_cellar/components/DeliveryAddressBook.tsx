'use client';

import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import ConfirmAction from '@/app/_cellar/components/ConfirmAction';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

export interface DeliveryAddressBookProps {
  /** Called when another address becomes the main one, so the form above can follow */
  onMainChanged: (main: { address: string; instructions: string | null }) => void;
}

interface Draft {
  id?: string;
  label: string;
  address: string;
  instructions: string;
}

const EMPTY: Draft = { label: '', address: '', instructions: '' };

const LABEL =
  'text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider';

/**
 * The member's other delivery addresses — the office, a friend's villa
 *
 * The main address is edited in the form above it; this lists the rest, adds
 * new ones, and makes one of them the main address. Making an address the main
 * one is a quiet change and needs no confirmation; removing one does.
 */
const DeliveryAddressBook = ({ onMainChanged }: DeliveryAddressBookProps) => {
  const api = useTRPC();
  const [draft, setDraft] = useState<Draft | null>(null);

  const { data, refetch } = useQuery({
    ...api.cellar.member.getAddresses.queryOptions(),
  });

  /* The main address is shown in the form above; this section is for the rest */
  const others = (data?.addresses ?? []).filter(
    (address) => !address.isDefault && address.id,
  );

  const { mutate: save, isPending: isSaving } = useMutation(
    api.cellar.member.saveAddress.mutationOptions({
      onSuccess: (_result, variables) => {
        if (variables.makeDefault) {
          onMainChanged({
            address: variables.address,
            instructions: variables.instructions ?? null,
          });
          toast.success(`${variables.label} is now your main address.`);
        } else {
          toast.success('Address saved.');
        }

        setDraft(null);
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: remove } = useMutation(
    api.cellar.member.deleteAddress.mutationOptions({
      onSuccess: () => {
        toast.success('Address removed.');
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <div className="border-border-muted mt-4 border-t pt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <Typography variant="bodyXs" className="font-semibold">
          Other addresses
        </Typography>
        {!draft && (
          <button
            type="button"
            onClick={() => setDraft(EMPTY)}
            className="text-text-primary inline-flex items-center gap-1 text-xs font-semibold hover:underline"
          >
            <IconPlus size={13} />
            Add an address
          </button>
        )}
      </div>

      {others.length === 0 && !draft && (
        <Typography variant="bodyXs" colorRole="muted" className="block">
          Save an office, a second home or a friend&rsquo;s address to choose
          it when you request a delivery.
        </Typography>
      )}

      <ul className="flex flex-col gap-2">
        {others.map((address) => (
          <li
            key={address.id}
            className="border-border-muted flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-text-primary text-sm font-semibold">
                {address.label}
              </p>
              <p className="text-text-muted text-xs">{address.address}</p>
              {address.instructions && (
                <p className="text-text-muted text-xs">{address.instructions}</p>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center gap-3 text-xs font-semibold">
              <button
                type="button"
                disabled={isSaving}
                onClick={() =>
                  save({
                    id: address.id ?? undefined,
                    label: address.label,
                    address: address.address,
                    instructions: address.instructions,
                    makeDefault: true,
                  })
                }
                className="text-text-primary hover:underline disabled:opacity-50"
              >
                Make main
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    id: address.id ?? undefined,
                    label: address.label,
                    address: address.address,
                    instructions: address.instructions ?? '',
                  })
                }
                className="text-text-muted hover:text-text-primary"
              >
                Edit
              </button>
              <ConfirmAction
                title={`Remove ${address.label}?`}
                description={
                  <p>
                    It comes off your saved addresses. Deliveries already
                    requested to it are not affected.
                  </p>
                }
                confirmLabel="Remove address"
                tone="danger"
                onConfirm={() => address.id && remove({ id: address.id })}
              >
                <button
                  type="button"
                  className="text-text-muted hover:text-red-700"
                >
                  Remove
                </button>
              </ConfirmAction>
            </div>
          </li>
        ))}
      </ul>

      {draft && (
        <div className="border-border-muted mt-2 grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}>Name</span>
            <Input
              value={draft.label}
              onChange={(event) =>
                setDraft({ ...draft, label: event.target.value })
              }
              placeholder="e.g. Office"
              maxLength={60}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Access notes &mdash; optional</span>
            <Input
              value={draft.instructions}
              onChange={(event) =>
                setDraft({ ...draft, instructions: event.target.value })
              }
              placeholder="Gate code, who to ask for"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={LABEL}>Address</span>
            <Input
              value={draft.address}
              onChange={(event) =>
                setDraft({ ...draft, address: event.target.value })
              }
              placeholder="Villa or office, area, emirate"
            />
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() =>
                save({
                  id: draft.id,
                  label: draft.label.trim(),
                  address: draft.address.trim(),
                  instructions: draft.instructions.trim() || null,
                })
              }
              className="bg-text-primary text-surface-primary h-9 rounded-lg px-4 text-xs font-semibold disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save address'}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="text-text-muted hover:text-text-primary text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryAddressBook;
