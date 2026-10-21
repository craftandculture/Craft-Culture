'use client';

import type { inferRouterOutputs } from '@trpc/server';
import { useState } from 'react';

import type { AppRouter } from '@/trpc-router';

import { card, pillClass, sectionHeading } from '../exports/exportUi';

type Request = inferRouterOutputs<AppRouter>['logistics']['admin']['requests']['getOne'];

export interface EmailHistoryProps {
  request: Request;
}

const KIND_LABEL: Record<string, string> = {
  request: 'Request',
  chase: 'Reminder',
  award: 'Award',
  decline: 'Not chosen',
};

const when = (d: Date) =>
  d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' });

/**
 * Every email this request sent from logistics@, newest first
 *
 * Each row opens to the email exactly as it went, so anyone can see what a
 * forwarder was told without searching the inbox.
 */
const EmailHistory = ({ request }: EmailHistoryProps) => {
  const [open, setOpen] = useState<string | null>(null);

  if (request.emails.length === 0) return null;

  return (
    <div className={card}>
      <div className="flex items-center gap-2 border-b border-border-muted px-4 py-3">
        <span className={sectionHeading}>Emails sent</span>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-muted">
          {request.emails.length}
        </span>
      </div>
      <ul className="divide-y divide-border-muted">
        {request.emails.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => setOpen(open === e.id ? null : e.id)}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-surface-secondary/50"
            >
              <span className={pillClass(e.status === 'sent' ? 'emerald' : 'red')}>
                {e.status === 'sent' ? KIND_LABEL[e.kind] ?? e.kind : 'Failed'}
              </span>
              <span className="font-medium text-text-primary">{e.forwarderName ?? 'Forwarder'}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-text-muted">{e.toEmails.join(', ')}</span>
              <span className="shrink-0 text-xs text-text-muted">{when(e.createdAt)}</span>
            </button>
            {open === e.id && (
              <div className="space-y-2 border-t border-border-muted bg-surface-secondary/30 px-4 py-3">
                {e.error && <p className="text-xs text-red-600">Not sent: {e.error}</p>}
                <p className="text-sm font-medium text-text-primary">{e.subject}</p>
                <pre className="whitespace-pre-wrap font-sans text-sm text-text-primary">{e.body}</pre>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default EmailHistory;
