'use client';

import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import type { WineSource } from '../../constants/wineSources';
import wineSources from '../../constants/wineSources';

const field =
  'border-border-muted bg-surface-primary text-text-primary h-9 w-full rounded-lg border px-2.5 text-sm';

/** The sources staff record for a member: wine moving in, or already with us */
const offered = wineSources.filter(
  (source) =>
    source.value !== 'starting_fresh' && source.value !== 'uae_in_bond',
);

export interface AddIntakeFormProps {
  onAdded: () => void;
}

/**
 * Record a transfer for a member, optionally on the shipment carrying it
 *
 * For wine we already know is on its way: the member's cellar shows it as "on
 * its way" the first time they open it, without their having to tell us.
 */
const AddIntakeForm = ({ onAdded }: AddIntakeFormProps) => {
  const api = useTRPC();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    partnerId: '',
    source: 'uk_eu_cellar' as WineSource,
    holderName: '',
    approxCases: '',
    shipmentId: '',
  });

  const { data: members } = useQuery({
    ...api.cellar.admin.getMembers.queryOptions(),
    enabled: isOpen,
  });
  const { data: shipments = [] } = useQuery({
    ...api.onboarding.admin.listLinkableShipments.queryOptions(),
    enabled: isOpen,
  });

  const add = useMutation(
    api.onboarding.admin.addIntake.mutationOptions({
      onSuccess: () => {
        toast.success(
          form.shipmentId
            ? 'Transfer recorded and linked to its shipment'
            : 'Transfer recorded',
        );
        setIsOpen(false);
        setForm({
          partnerId: '',
          source: 'uk_eu_cellar',
          holderName: '',
          approxCases: '',
          shipmentId: '',
        });
        onAdded();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="bg-text-primary text-surface-primary inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold"
      >
        <IconPlus size={14} /> Add a transfer for a member
      </button>
    );
  }

  const isTransfer = wineSources.find(
    (source) => source.value === form.source,
  )?.isTransfer;

  return (
    <form
      className="border-border-muted bg-surface-primary space-y-3 rounded-xl border p-4 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (!form.partnerId) {
          toast.error('Choose the member.');
          return;
        }
        add.mutate({
          partnerId: form.partnerId,
          source: form.source,
          holderName: form.holderName.trim() || undefined,
          approxCases: form.approxCases ? Number(form.approxCases) : undefined,
          shipmentId:
            isTransfer && form.shipmentId ? form.shipmentId : undefined,
        });
      }}
    >
      <p className="text-text-primary text-sm font-semibold">
        Add a transfer for a member
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">
            Member
          </span>
          <select
            className={field}
            value={form.partnerId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                partnerId: event.target.value,
              }))
            }
          >
            <option value="">Choose…</option>
            {[...(members?.members ?? [])]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                  {member.code ? ` · ${member.code}` : ''}
                </option>
              ))}
          </select>
        </label>
        <label className="block">
          <span className="text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">
            Where it is
          </span>
          <select
            className={field}
            value={form.source}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                source: event.target.value as WineSource,
              }))
            }
          >
            {offered.map((source) => (
              <option key={source.value} value={source.value}>
                {source.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">
            Held by (optional)
          </span>
          <input
            className={field}
            value={form.holderName}
            placeholder="e.g. Berry Bros. & Rudd"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                holderName: event.target.value,
              }))
            }
          />
        </label>
        <label className="block">
          <span className="text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">
            About how many cases (optional)
          </span>
          <input
            className={field}
            inputMode="numeric"
            value={form.approxCases}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                approxCases: event.target.value.replace(/\D/g, ''),
              }))
            }
          />
        </label>
        {isTransfer && (
          <label className="block sm:col-span-2">
            <span className="text-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">
              Shipment carrying it (optional)
            </span>
            <select
              className={field}
              value={form.shipmentId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  shipmentId: event.target.value,
                }))
              }
            >
              <option value="">Not booked yet</option>
              {shipments.map((item) => (
                <option key={item.id} value={item.id}>
                  {[
                    item.shipmentNumber,
                    item.name,
                    item.partnerName,
                    item.status.replace(/_/g, ' '),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={add.isPending}
          className="bg-text-primary text-surface-primary h-9 rounded-lg px-3 text-xs font-semibold disabled:opacity-50"
        >
          {add.isPending ? 'Saving…' : 'Record transfer'}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-text-muted text-xs hover:underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default AddIntakeForm;
