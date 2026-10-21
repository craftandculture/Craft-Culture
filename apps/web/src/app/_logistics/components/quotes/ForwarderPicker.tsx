'use client';

import { IconPlus, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import useTRPC from '@/lib/trpc/browser';

import { card, input, secondaryButton, sectionHeading } from '../exports/exportUi';

export interface NewForwarder {
  name: string;
  email: string;
}

export interface ForwarderPickerProps {
  originCountry: string;
  destinationCountry: string;
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  added: NewForwarder[];
  onAddedChange: (added: NewForwarder[]) => void;
}

/**
 * Choose the forwarders a new request goes to
 *
 * Forwarders that have quoted the same route are ticked as soon as the route
 * is entered, until someone changes the ticks. A forwarder not yet on file is
 * typed in by name and email and added when the request is saved.
 */
const ForwarderPicker = ({
  originCountry,
  destinationCountry,
  selected,
  onSelectedChange,
  added,
  onAddedChange,
}: ForwarderPickerProps) => {
  const api = useTRPC();
  const touched = useRef(false);

  const { data: forwarders = [] } = useQuery(
    api.logistics.admin.forwarders.getMany.queryOptions({
      originCountry: originCountry || undefined,
      destinationCountry: destinationCountry || undefined,
    }),
  );

  // The usual forwarders for the route, until the person picks their own
  const usual = forwarders.filter((f) => f.usedOnRoute || f.coversRoute).map((f) => f.id).join(',');
  useEffect(() => {
    if (!touched.current) onSelectedChange(usual ? usual.split(',') : []);
  }, [usual, onSelectedChange]);

  const toggle = (id: string) => {
    touched.current = true;
    onSelectedChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const update = (i: number, field: keyof NewForwarder, value: string) =>
    onAddedChange(added.map((f, j) => (j === i ? { ...f, [field]: value } : f)));

  return (
    <div className={`${card} space-y-3 p-4`}>
      <div>
        <span className={sectionHeading}>Forwarders to ask</span>
        <p className="mt-0.5 text-xs text-text-muted">
          Forwarders that have quoted this route, or collect from its origin, are ticked. Each gets its own email.
        </p>
      </div>

      {forwarders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {forwarders.map((f) => (
            <label
              key={f.id}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                selected.includes(f.id) ? 'border-text-primary text-text-primary' : 'border-border-muted text-text-secondary'
              }`}
            >
              <input type="checkbox" checked={selected.includes(f.id)} onChange={() => toggle(f.id)} />
              {f.name}
              {f.usedOnRoute ? (
                    <span className="text-[11px] text-text-muted">used on this route</span>
                  ) : f.coversRoute ? (
                    <span className="text-[11px] text-text-muted">covers this route</span>
                  ) : null}
              {f.contacts.length === 0 && <span className="text-[11px] text-amber-600">no email</span>}
            </label>
          ))}
        </div>
      )}

      {added.map((f, i) => (
        <div key={i} className="flex gap-2">
          <input
            className={input}
            placeholder="Forwarder name"
            value={f.name}
            onChange={(e) => update(i, 'name', e.target.value)}
          />
          <input
            className={input}
            type="email"
            placeholder="Their email"
            value={f.email}
            onChange={(e) => update(i, 'email', e.target.value)}
          />
          <button
            type="button"
            aria-label="Remove"
            className={secondaryButton}
            onClick={() => onAddedChange(added.filter((_, j) => j !== i))}
          >
            <IconX size={15} />
          </button>
        </div>
      ))}

      <button type="button" className={secondaryButton} onClick={() => onAddedChange([...added, { name: '', email: '' }])}>
        <IconPlus size={15} /> A forwarder not listed
      </button>
    </div>
  );
};

export default ForwarderPicker;
