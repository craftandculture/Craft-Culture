'use client';

import { IconCheck, IconPencil, IconShieldCheck } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

export interface OrderClientCardClient {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  country: string | null;
  cityDrinksVerifiedAt: Date | string | null;
}

export interface OrderClientCardProps {
  /** Null on older orders that were typed in without a client record. */
  client: OrderClientCardClient | null;
  /** The order's own copy, which is what ships on the paperwork. */
  fallback: { name: string | null; email: string | null; phone: string | null };
}

interface Draft {
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
}

const FIELDS: { key: keyof Draft; label: string; type?: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'addressLine1', label: 'Address line 1' },
  { key: 'addressLine2', label: 'Address line 2' },
  { key: 'city', label: 'City' },
  { key: 'stateProvince', label: 'Emirate / State' },
  { key: 'postalCode', label: 'Postal code' },
  { key: 'country', label: 'Country' },
];

/**
 * The client on an order: who they are, whether they are verified, and a way
 * to correct both without leaving the order.
 *
 * Two things this fixes. Client details could not be corrected by an admin at
 * all — the update is scoped to the partner who owns the record — so a wrong
 * phone number had to go back to the partner while the distributor delivered
 * against it. And a client everyone already knows still went round the
 * verification loop, because nothing could mark them verified up front.
 *
 * Edits are saved to the client record and carried onto their orders that are
 * still in flight. Delivered and cancelled orders keep what was true then.
 */
const OrderClientCard = ({ client, fallback }: OrderClientCardProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  const verified = !!client?.cityDrinksVerifiedAt;

  const refresh = () => void queryClient.invalidateQueries();

  const updateMutation = useMutation({
    ...api.privateClientContacts.adminUpdate.mutationOptions(),
    onSuccess: (result) => {
      const n = result.ordersUpdated;
      toast.success(
        n > 0
          ? `Client updated · ${n} open order${n === 1 ? '' : 's'} updated too`
          : 'Client updated',
      );
      setEditing(false);
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const verifyMutation = useMutation({
    ...api.privateClientContacts.adminSetVerified.mutationOptions(),
    // Reported from what was saved, not from what was asked for.
    onSuccess: (data) => {
      toast.success(
        data?.cityDrinksVerifiedAt
          ? 'Client marked verified — new orders skip verification'
          : 'Verification withdrawn',
      );
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const startEditing = () => {
    if (!client) return;
    setDraft({
      name: client.name ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      addressLine1: client.addressLine1 ?? '',
      addressLine2: client.addressLine2 ?? '',
      city: client.city ?? '',
      stateProvince: client.stateProvince ?? '',
      postalCode: client.postalCode ?? '',
      country: client.country ?? '',
    });
    setEditing(true);
  };

  const name = client?.name ?? fallback.name;
  const email = client?.email ?? fallback.email;
  const phone = client?.phone ?? fallback.phone;

  return (
    <div className="rounded-xl border border-border-muted bg-fill-primary p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
          Client
        </span>
        {client && (
          <button
            type="button"
            onClick={startEditing}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] text-text-muted hover:bg-fill-secondary hover:text-text-primary"
          >
            <IconPencil className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
      </div>

      <div className="space-y-1 text-sm">
        <p className="font-medium">{name || '-'}</p>
        <p className="text-[12px] text-text-muted">{email || '-'}</p>
        <p className="text-[12px] text-text-muted">{phone || '-'}</p>
      </div>

      {client ? (
        <div className="mt-3 border-t border-border-muted pt-3">
          {verified ? (
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <IconShieldCheck className="h-3.5 w-3.5" />
                Verified
              </span>
              <button
                type="button"
                disabled={verifyMutation.isPending}
                onClick={() =>
                  verifyMutation.mutate({ id: client.id, verified: false })
                }
                className="text-[11px] text-text-muted underline-offset-2 hover:underline disabled:opacity-50"
              >
                Withdraw
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={verifyMutation.isPending}
                onClick={() =>
                  verifyMutation.mutate({ id: client.id, verified: true })
                }
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                <IconCheck className="h-3.5 w-3.5" />
                {verifyMutation.isPending ? 'Saving…' : 'Mark client verified'}
              </button>
              <p className="mt-1.5 text-[11px] leading-snug text-text-muted">
                Skips partner and distributor verification when a distributor is
                assigned, so the order goes straight to payment.
              </p>
            </>
          )}
        </div>
      ) : (
        <p className="mt-3 border-t border-border-muted pt-3 text-[11px] leading-snug text-text-muted">
          This order was typed in without a client record, so there is nothing to
          edit or verify. The details above travel with the order only.
        </p>
      )}

      {editing && draft && client && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-xl border border-border-primary bg-fill-primary p-5 shadow-xl">
            <h2 className="text-base font-bold">Edit client</h2>
            <p className="mt-1 mb-4 text-[12px] text-text-muted">
              Saved to the client record and applied to their open orders.
              Delivered and cancelled orders keep the details they shipped with.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <label
                  key={field.key}
                  className={field.key === 'name' ? 'sm:col-span-2' : undefined}
                >
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-text-muted">
                    {field.label}
                  </span>
                  <input
                    type={field.type ?? 'text'}
                    value={draft[field.key]}
                    onChange={(event) =>
                      setDraft({ ...draft, [field.key]: event.target.value })
                    }
                    className="w-full rounded-lg border border-border-muted bg-background-primary px-2.5 py-1.5 text-sm"
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-border-muted px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!draft.name.trim() || updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({ id: client.id, ...draft })
                }
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderClientCard;
