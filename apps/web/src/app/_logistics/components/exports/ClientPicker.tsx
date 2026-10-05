'use client';

import { IconCheck } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import useTRPC from '@/lib/trpc/browser';

import { input } from './exportUi';

export interface ClientValue {
  clientName: string;
  zohoCustomerId: string | null;
}

/**
 * Choose the client from Zoho, or type one in
 *
 * Suggestions are the customers invoiced in the last six months. Picking one
 * links the job to that Zoho customer; typing anything after that makes it a
 * typed name again, for one-off jobs that are not in Zoho.
 */
const ClientPicker = ({ value, onChange, id }: { value: ClientValue; onChange: (v: ClientValue) => void; id?: string }) => {
  const api = useTRPC();
  const { data: customers } = useQuery(api.exportInvoices.admin.consignees.queryOptions());
  const [open, setOpen] = useState(false);

  const q = value.clientName.trim().toLowerCase();
  const matches = (customers ?? [])
    .filter((c) => !q || c.displayName.toLowerCase().includes(q) || c.customerName.toLowerCase().includes(q))
    .slice(0, 8);

  return (
    <div className="relative">
      <input
        id={id}
        value={value.clientName}
        onChange={(e) => onChange({ clientName: e.target.value, zohoCustomerId: null })}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search Zoho customers or type a name"
        className={input}
        autoComplete="off"
      />
      {value.zohoCustomerId ? (
        <span className="pointer-events-none absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <IconCheck size={11} /> Zoho
        </span>
      ) : null}
      {open && matches.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border-muted bg-surface-primary py-1 shadow-lg">
          {matches.map((c) => (
            <li key={c.zohoCustomerId}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange({ clientName: c.displayName, zohoCustomerId: c.zohoCustomerId });
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-secondary"
              >
                <span className="truncate">{c.displayName}</span>
                {c.hasProfile ? <span className="shrink-0 text-[11px] text-text-muted">Export profile</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default ClientPicker;
