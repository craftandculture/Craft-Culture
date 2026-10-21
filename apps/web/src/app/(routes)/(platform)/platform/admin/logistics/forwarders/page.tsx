'use client';

import { IconChevronRight, IconPlus, IconSearch, IconUpload } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { card, pill, pillClass, primaryButton, secondaryButton } from '@/app/_logistics/components/exports/exportUi';
import ForwarderForm from '@/app/_logistics/components/quotes/ForwarderForm';
import ForwarderImport from '@/app/_logistics/components/quotes/ForwarderImport';
import useTRPC from '@/lib/trpc/browser';

const MODE_LABEL: Record<string, string> = { air: 'Air', sea_fcl: 'Sea FCL', sea_lcl: 'Sea LCL', road: 'Road' };

/**
 * The forwarders freight requests go to
 *
 * Kept once, with each forwarder's people and emails, the modes it quotes and
 * the countries it collects from, so a request only needs them ticked. Brought
 * in from a spreadsheet the first time; forwarders that send a quote are
 * added on their own as well.
 */
const ForwardersPage = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<'add' | 'import' | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const { data: forwarders = [], isLoading } = useQuery(
    api.logistics.admin.forwarders.getMany.queryOptions({ includeInactive: true }),
  );

  const update = useMutation({
    ...api.logistics.admin.forwarders.update.mutationOptions(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'forwarders']] }),
    onError: (error) => toast.error(error.message || 'Not saved'),
  });

  const term = search.trim().toLowerCase();
  const shown = forwarders.filter(
    (f) =>
      (showInactive || f.isActive) &&
      (!term ||
        f.name.toLowerCase().includes(term) ||
        f.contacts.some((c) => `${c.email} ${c.name ?? ''}`.toLowerCase().includes(term)) ||
        f.originCountries.some((c) => c.toLowerCase().includes(term))),
  );
  const inactive = forwarders.filter((f) => !f.isActive).length;
  const noEmail = forwarders.filter((f) => f.isActive && f.contacts.length === 0).length;

  return (
    <div className="container mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-sm text-text-muted">
            <Link href="/platform/admin/logistics/quotes" className="hover:text-text-primary">
              Freight quotes
            </Link>
            <IconChevronRight className="size-4" />
            <span className="text-text-primary">Forwarders</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Forwarders</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Who freight requests go to: their people, what they quote for and where they collect from
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={secondaryButton} onClick={() => setPanel(panel === 'import' ? null : 'import')}>
            <IconUpload size={16} /> Import a list
          </button>
          <button type="button" className={primaryButton} onClick={() => setPanel(panel === 'add' ? null : 'add')}>
            <IconPlus size={16} /> Add forwarder
          </button>
        </div>
      </div>

      {panel && (
        <div className={`${card} p-4`}>
          {panel === 'add' ? (
            <ForwarderForm onDone={() => setPanel(null)} />
          ) : (
            <ForwarderImport onDone={() => setPanel(null)} />
          )}
        </div>
      )}

      {noEmail > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          {noEmail} forwarder{noEmail === 1 ? ' has' : 's have'} no email yet, so requests cannot be sent to{' '}
          {noEmail === 1 ? 'it' : 'them'}.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by forwarder, person, email or country"
            className="h-11 w-full rounded-xl border border-border-muted bg-surface-primary pl-10 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:border-text-primary focus:outline-none"
          />
        </div>
        {inactive > 0 && (
          <button type="button" className={pill(showInactive)} onClick={() => setShowInactive((s) => !s)}>
            Switched off <span className="ml-1.5 tabular-nums opacity-60">{inactive}</span>
          </button>
        )}
      </div>

      <div className={card}>
        {isLoading ? (
          <p className="py-12 text-center text-sm text-text-muted">Loading forwarders…</p>
        ) : shown.length === 0 ? (
          <p className="py-12 text-center text-sm text-text-muted">
            {forwarders.length ? 'No forwarders match.' : 'No forwarders yet. Import your list or add the first.'}
          </p>
        ) : (
          <ul className="divide-y divide-border-muted">
            {shown.map((f) => (
              <li key={f.id} className="px-4 py-3">
                {editing === f.id ? (
                  <div className="space-y-4">
                    <ForwarderForm forwarder={f} onDone={() => setEditing(null)} />
                    <div className="flex flex-wrap items-center gap-2 border-t border-border-muted pt-3">
                      <button
                        type="button"
                        className={secondaryButton}
                        onClick={() => update.mutate({ forwarderId: f.id, isActive: !f.isActive })}
                      >
                        {f.isActive ? 'Switch off' : 'Switch back on'}
                      </button>
                      <select
                        className="h-9 rounded-lg border border-border-muted bg-surface-primary px-2 text-sm text-text-primary"
                        defaultValue=""
                        onChange={(e) => {
                          if (!e.target.value) return;
                          update.mutate(
                            { forwarderId: f.id, mergeIntoId: e.target.value },
                            { onSuccess: () => setEditing(null) },
                          );
                        }}
                      >
                        <option value="">Duplicate of…</option>
                        {forwarders
                          .filter((o) => o.id !== f.id)
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              Merge into {o.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="w-full text-left" onClick={() => setEditing(f.id)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">{f.name}</span>
                      {!f.isActive && <span className={pillClass('slate')}>Switched off</span>}
                      {f.modes.map((m) => (
                        <span key={m} className={pillClass('blue')}>
                          {MODE_LABEL[m] ?? m}
                        </span>
                      ))}
                      {f.quoteCount > 0 && (
                        <span className="text-xs text-text-muted">
                          {f.quoteCount} quote{f.quoteCount === 1 ? '' : 's'}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-text-muted">Edit</span>
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {f.contacts.length
                        ? f.contacts.map((c) => [c.name, c.email, c.phone].filter(Boolean).join(' · ')).join('   |   ')
                        : 'No email yet'}
                    </p>
                    {f.originCountries.length > 0 && (
                      <p className="text-xs text-text-muted">Collects from {f.originCountries.join(', ')}</p>
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ForwardersPage;
