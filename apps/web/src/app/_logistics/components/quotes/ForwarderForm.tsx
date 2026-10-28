'use client';

import { IconPlus, IconX } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';
import type { AppRouter } from '@/trpc-router';

import forwarderCountries, {
  GLOBAL_COVERAGE,
} from '../../constants/forwarderCountries';
import normaliseCountry from '../../utils/normaliseCountry';
import {
  input,
  label,
  primaryButton,
  secondaryButton,
} from '../exports/exportUi';

type Forwarder =
  inferRouterOutputs<AppRouter>['logistics']['admin']['forwarders']['getMany'][number];
type Mode = 'air' | 'sea_fcl' | 'sea_lcl' | 'road';

export interface ForwarderFormProps {
  /** The forwarder to edit; omitted to add a new one */
  forwarder?: Forwarder;
  onDone: () => void;
}

const MODES: { key: Mode; label: string }[] = [
  { key: 'air', label: 'Air' },
  { key: 'sea_fcl', label: 'Sea, full container' },
  { key: 'sea_lcl', label: 'Sea, shared container' },
  { key: 'road', label: 'Road' },
];

const blank = { name: '', email: '', phone: '', role: '' };

/**
 * Add or edit a forwarder: its people, the modes it quotes and where it
 * collects from
 */
const ForwarderForm = ({ forwarder, onDone }: ForwarderFormProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [name, setName] = useState(forwarder?.name ?? '');
  const [contacts, setContacts] = useState(
    forwarder?.contacts.length
      ? forwarder.contacts.map((c) => ({
          name: c.name ?? '',
          email: c.email,
          phone: c.phone ?? '',
          role: c.role ?? '',
        }))
      : [blank],
  );
  const [modes, setModes] = useState<Mode[]>(
    (forwarder?.modes ?? []) as Mode[],
  );
  const [countries, setCountries] = useState<string[]>(
    forwarder?.originCountries ?? [],
  );
  const [notes, setNotes] = useState(forwarder?.notes ?? '');

  const done = () => {
    void queryClient.invalidateQueries({
      queryKey: [['logistics', 'admin', 'forwarders']],
    });
    onDone();
  };
  const onError = (error: { message: string }) =>
    toast.error(error.message || 'Not saved');

  const create = useMutation({
    ...api.logistics.admin.forwarders.create.mutationOptions(),
    onSuccess: done,
    onError,
  });
  const update = useMutation({
    ...api.logistics.admin.forwarders.update.mutationOptions(),
    onSuccess: done,
    onError,
  });

  const entered = contacts.filter((c) => c.email.trim());
  const badEmail = entered.find((c) => !/^\S+@\S+\.\S+$/.test(c.email.trim()));
  const payload = {
    name: name.trim(),
    contacts: entered.map((c) => ({
      email: c.email.trim(),
      name: c.name.trim() || undefined,
      phone: c.phone.trim() || undefined,
      role: c.role.trim() || undefined,
    })),
    modes,
    originCountries: countries,
    notes: notes.trim() || undefined,
  };

  const save = () =>
    forwarder
      ? update.mutate({
          forwarderId: forwarder.id,
          ...payload,
          notes: payload.notes ?? null,
        })
      : create.mutate(payload);

  // Global stands alone: it covers every country, so picking a country replaces it and vice versa
  const addCountry = (country: string) =>
    setCountries((cs) =>
      country === GLOBAL_COVERAGE
        ? [GLOBAL_COVERAGE]
        : [
            ...cs.filter((c) => c !== GLOBAL_COVERAGE && c !== country),
            country,
          ],
    );
  const isGlobal = countries.includes(GLOBAL_COVERAGE);
  // Countries already on file that are not in the list (e.g. from an import) still show and can be removed
  const options = [
    ...new Set([...forwarderCountries, ...countries.map(normaliseCountry)]),
  ]
    .filter((c) => c !== GLOBAL_COVERAGE && !countries.includes(c))
    .sort();

  const setContact = (i: number, field: keyof typeof blank, value: string) =>
    setContacts((cs) =>
      cs.map((c, j) => (j === i ? { ...c, [field]: value } : c)),
    );

  return (
    <div className="space-y-4">
      <div>
        <span className={label}>Forwarder</span>
        <input
          className={input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Hillebrand"
        />
      </div>

      <div className="space-y-2">
        <span className={label}>
          People and emails (quote requests go to every email here)
        </span>
        {contacts.map((c, i) => (
          <div
            key={i}
            className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1.4fr_1fr_1fr_auto]"
          >
            <input
              className={input}
              placeholder="Name"
              value={c.name}
              onChange={(e) => setContact(i, 'name', e.target.value)}
            />
            <input
              className={input}
              type="email"
              placeholder="Email"
              value={c.email}
              onChange={(e) => setContact(i, 'email', e.target.value)}
            />
            <input
              className={input}
              placeholder="Phone"
              value={c.phone}
              onChange={(e) => setContact(i, 'phone', e.target.value)}
            />
            <input
              className={input}
              placeholder="Role, e.g. Air quotes"
              value={c.role}
              onChange={(e) => setContact(i, 'role', e.target.value)}
            />
            <button
              type="button"
              aria-label="Remove this person"
              className={secondaryButton}
              onClick={() =>
                setContacts((cs) =>
                  cs.length > 1 ? cs.filter((_, j) => j !== i) : [blank],
                )
              }
            >
              <IconX size={15} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className={secondaryButton}
          onClick={() => setContacts((cs) => [...cs, blank])}
        >
          <IconPlus size={15} /> Another person
        </button>
      </div>

      <div>
        <span className={label}>Quotes for</span>
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <label
              key={m.key}
              className="text-text-primary flex items-center gap-1.5 text-sm"
            >
              <input
                type="checkbox"
                checked={modes.includes(m.key)}
                onChange={() =>
                  setModes((ms) =>
                    ms.includes(m.key)
                      ? ms.filter((x) => x !== m.key)
                      : [...ms, m.key],
                  )
                }
              />
              {m.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className={label}>Collects from</span>
        {countries.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {countries.map((c) => (
              <span
                key={c}
                className="border-border-muted text-text-primary inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm"
              >
                {c === GLOBAL_COVERAGE ? 'Global (anywhere)' : c}
                <button
                  type="button"
                  aria-label={`Remove ${c}`}
                  className="text-text-muted hover:text-text-primary"
                  onClick={() =>
                    setCountries((cs) => cs.filter((x) => x !== c))
                  }
                >
                  <IconX size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
        <select
          className={input}
          value=""
          onChange={(e) => {
            if (e.target.value) addCountry(e.target.value);
          }}
        >
          <option value="">
            {countries.length ? 'Add another country…' : 'Choose a country…'}
          </option>
          {!isGlobal && (
            <option value={GLOBAL_COVERAGE}>
              Global (collects from anywhere)
            </option>
          )}
          {options.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <p className="text-text-muted mt-1 text-xs">
          A new request from one of these countries ticks this forwarder. Global
          ticks it on every request.
        </p>
      </div>

      <div>
        <span className={label}>Notes</span>
        <input
          className={input}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Best on UK air; needs 48 hours for collection"
        />
      </div>

      {badEmail && (
        <p className="text-xs text-red-600">
          {badEmail.email} is not an email address.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className={primaryButton}
          disabled={
            !payload.name || !!badEmail || create.isPending || update.isPending
          }
          onClick={save}
        >
          {forwarder ? 'Save changes' : 'Add forwarder'}
        </button>
        <button type="button" className={secondaryButton} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ForwarderForm;
