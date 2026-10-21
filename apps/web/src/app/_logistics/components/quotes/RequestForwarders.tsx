'use client';

import { IconPlus, IconUsers } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';
import type { AppRouter } from '@/trpc-router';

import CopyTextCard from './CopyTextCard';
import buildFreightEmail from '../../utils/buildFreightEmail';
import { CHASE_AFTER_WORKING_DAYS } from '../../utils/quoteRequestNextStep';
import workingDaysSince from '../../utils/workingDaysSince';
import { card, input, pillClass, primaryButton, secondaryButton, sectionHeading } from '../exports/exportUi';

type Request = inferRouterOutputs<AppRouter>['logistics']['admin']['requests']['getOne'];

export interface RequestForwardersProps {
  request: Request;
}

const shortDay = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/**
 * The forwarders a request goes to, and the email for each
 *
 * Forwarders that have quoted this route before are ticked to start with.
 * Each forwarder still to be asked gets its email; copying it records it as
 * sent. A forwarder due a chase gets the reminder instead. Several unsent
 * forwarders can also go on one email, in Bcc.
 */
const RequestForwarders = ({ request }: RequestForwardersProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const isOpen = request.status !== 'completed' && request.status !== 'cancelled';

  const [editing, setEditing] = useState(request.recipients.length === 0 && isOpen);
  const [ticked, setTicked] = useState<Set<string> | null>(null);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailFor, setEmailFor] = useState<Record<string, string>>({});

  const { data: forwarders = [] } = useQuery({
    ...api.logistics.admin.forwarders.getMany.queryOptions({
      originCountry: request.originCountry,
      destinationCountry: request.destinationCountry,
    }),
    enabled: editing,
  });

  // Until someone ticks a box: the forwarders already on the request, or else the usual ones for this route
  const selected = useMemo(
    () =>
      ticked ??
      new Set(
        request.recipients.length
          ? request.recipients.map((r) => r.forwarderId)
          : forwarders.filter((f) => f.usedOnRoute).map((f) => f.id),
      ),
    [ticked, request.recipients, forwarders],
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'requests']] });
    void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'forwarders']] });
  };

  const setRecipients = useMutation({
    ...api.logistics.admin.requests.setRecipients.mutationOptions(),
    onSuccess: () => {
      setEditing(false);
      setTicked(null);
      setNewName('');
      setNewEmail('');
      refresh();
    },
    onError: (error) => toast.error(error.message || 'Could not save the forwarders'),
  });

  const mark = useMutation({
    ...api.logistics.admin.requests.markRecipients.mutationOptions(),
    onSuccess: refresh,
    onError: (error) => toast.error(error.message || 'Could not record that'),
  });

  const updateForwarder = useMutation({
    ...api.logistics.admin.forwarders.update.mutationOptions(),
    onSuccess: refresh,
    onError: (error) => toast.error(error.message || 'Could not save the email'),
  });

  const markAs = (forwarderIds: string[], action: 'sent' | 'chased' | 'undo_sent' | 'undo_chased') =>
    mark.mutate({ requestId: request.id, forwarderIds, action });

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTicked(next);
  };

  const now = new Date();
  const chaseDue = (r: Request['recipients'][number]) =>
    r.outcome === 'awaiting' &&
    !!r.sentAt &&
    workingDaysSince(r.chasedAt ?? r.sentAt, now) >= CHASE_AFTER_WORKING_DAYS;

  const unsent = request.recipients.filter((r) => r.outcome === 'awaiting' && !r.sentAt && r.contacts.length > 0);

  const stateOf = (r: Request['recipients'][number]) => {
    if (r.outcome === 'quoted') return { label: 'Quoted', tone: 'emerald' as const };
    if (r.outcome === 'declined') return { label: 'Not chosen', tone: 'slate' as const };
    if (!r.sentAt) return { label: 'Not sent', tone: 'amber' as const };
    if (chaseDue(r)) return { label: `Chase due · sent ${shortDay(r.sentAt)}`, tone: 'red' as const };
    if (r.chasedAt) return { label: `Chased ${shortDay(r.chasedAt)}`, tone: 'blue' as const };
    return { label: `Sent ${shortDay(r.sentAt)}`, tone: 'blue' as const };
  };

  return (
    <div className={card}>
      <div className="flex items-center gap-2 border-b border-border-muted px-4 py-3">
        <IconUsers size={16} className="text-text-muted" />
        <span className={sectionHeading}>Forwarders</span>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-muted">
          {request.recipients.length}
        </span>
        {isOpen && !editing && (
          <button type="button" className={`${secondaryButton} ml-auto`} onClick={() => setEditing(true)}>
            Choose forwarders
          </button>
        )}
      </div>

      {editing && (
        <div className="space-y-3 border-b border-border-muted px-4 py-3">
          {forwarders.length === 0 ? (
            <p className="text-sm text-text-muted">
              No forwarders on file yet. Add the first below; every quote saved adds its forwarder too.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {forwarders.map((f) => (
                <label
                  key={f.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                    selected.has(f.id) ? 'border-text-primary text-text-primary' : 'border-border-muted text-text-secondary'
                  }`}
                >
                  <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} />
                  {f.name}
                  {f.usedOnRoute && <span className="text-[11px] text-text-muted">used on this route</span>}
                  {f.contacts.length === 0 && <span className="text-[11px] text-amber-600">no email</span>}
                </label>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className={input}
              placeholder="Another forwarder"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className={input}
              type="email"
              placeholder="Their email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={primaryButton}
              disabled={setRecipients.isPending || (selected.size === 0 && !newName.trim())}
              onClick={() =>
                setRecipients.mutate({
                  requestId: request.id,
                  forwarderIds: [...selected],
                  ...(newName.trim() ? { newForwarder: { name: newName.trim(), email: newEmail.trim() } } : {}),
                })
              }
            >
              <IconPlus size={15} /> Ask {selected.size + (newName.trim() ? 1 : 0)} forwarder
              {selected.size + (newName.trim() ? 1 : 0) === 1 ? '' : 's'}
            </button>
            {request.recipients.length > 0 && (
              <button type="button" className={secondaryButton} onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {request.recipients.length > 0 && (
        <ul className="divide-y divide-border-muted">
          {request.recipients.map((r) => {
            const state = stateOf(r);
            const forwarder = { name: r.name, contacts: r.contacts };
            const kind = !r.sentAt ? 'request' : chaseDue(r) ? 'chase' : null;

            return (
              <li key={r.forwarderId} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">{r.name}</span>
                  <span className={pillClass(state.tone)}>{state.label}</span>
                  <span className="text-xs text-text-muted">{r.contacts.map((c) => c.email).join(', ')}</span>
                </div>

                {r.contacts.length === 0 && r.outcome === 'awaiting' && (
                  <div className="flex gap-2">
                    <input
                      className={input}
                      type="email"
                      placeholder={`An email address at ${r.name}`}
                      value={emailFor[r.forwarderId] ?? ''}
                      onChange={(e) => setEmailFor((m) => ({ ...m, [r.forwarderId]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className={secondaryButton}
                      disabled={!emailFor[r.forwarderId]?.includes('@')}
                      onClick={() =>
                        updateForwarder.mutate({
                          forwarderId: r.forwarderId,
                          contacts: [{ email: emailFor[r.forwarderId]!.trim() }],
                        })
                      }
                    >
                      Save
                    </button>
                  </div>
                )}

                {kind && r.contacts.length > 0 && r.outcome === 'awaiting' && (
                  <CopyTextCard
                    title={kind === 'request' ? `Request to ${r.name}` : `Reminder to ${r.name}`}
                    email={buildFreightEmail({ kind, request, forwarders: [forwarder], senderName: request.senderName })}
                    onCopied={() => markAs([r.forwarderId], kind === 'request' ? 'sent' : 'chased')}
                    onUndo={() => markAs([r.forwarderId], kind === 'request' ? 'undo_sent' : 'undo_chased')}
                    defaultOpen={kind === 'chase'}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {unsent.length > 1 && (
        <div className="border-t border-border-muted px-4 py-3">
          <CopyTextCard
            title={`One email to all ${unsent.length}, in Bcc`}
            email={buildFreightEmail({
              kind: 'request',
              request,
              forwarders: unsent.map((r) => ({ name: r.name, contacts: r.contacts })),
              senderName: request.senderName,
            })}
            onCopied={() => markAs(unsent.map((r) => r.forwarderId), 'sent')}
            onUndo={() => markAs(unsent.map((r) => r.forwarderId), 'undo_sent')}
          />
        </div>
      )}
    </div>
  );
};

export default RequestForwarders;
