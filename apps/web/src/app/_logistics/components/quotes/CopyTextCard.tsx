'use client';

import { IconCheck, IconCopy, IconMail } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { card, pillClass, primaryButton, secondaryButton } from '../exports/exportUi';

export interface CopyTextCardProps {
  title: string;
  /** A pill beside the title, such as "Sent 21 Oct" */
  status?: { label: string; tone: 'slate' | 'amber' | 'emerald' | 'blue' | 'violet' | 'red' } | null;
  email: { to: string[]; bcc: string[]; subject: string; body: string };
  /** Called the first time the email is copied or opened, to record it as sent */
  onCopied?: () => void;
  /** Reverses `onCopied` from the toast, for a copy made by mistake */
  onUndo?: () => void;
  /** Collapsed cards show only the title row until opened */
  defaultOpen?: boolean;
}

/** Longest mailto link offered; beyond this mail apps truncate the body silently */
const MAILTO_LIMIT = 1800;

/**
 * An email ready to paste into the sender's own mail
 *
 * Copying the text, or opening it in the mail app, counts as sending: `onCopied`
 * records that, and the toast offers an undo for ten seconds. Addresses and
 * subject copy on their own as well, for mail apps that take them separately.
 */
const CopyTextCard = ({ title, status, email, onCopied, onUndo, defaultOpen = false }: CopyTextCardProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState<string | null>(null);

  const addresses = [...email.to, ...email.bcc].join(', ');
  const mailto = `mailto:${encodeURIComponent(email.to.join(','))}?${[
    email.bcc.length ? `bcc=${encodeURIComponent(email.bcc.join(','))}` : null,
    `subject=${encodeURIComponent(email.subject)}`,
    `body=${encodeURIComponent(email.body)}`,
  ]
    .filter(Boolean)
    .join('&')}`;

  const markSent = () => {
    if (!onCopied) return;
    onCopied();
    toast.success(`${title}: marked as sent`, {
      duration: 10_000,
      ...(onUndo ? { action: { label: 'Undo', onClick: onUndo } } : {}),
    });
  };

  const copy = async (what: 'email' | 'addresses' | 'subject', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
      if (what === 'email') markSent();
    } catch {
      toast.error('Copy failed; select the text and copy it instead');
    }
  };

  return (
    <div className={`${card} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <IconMail size={16} className="shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">{title}</span>
        {status && <span className={pillClass(status.tone)}>{status.label}</span>}
        <span className="text-xs text-text-muted">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border-muted px-4 py-3">
          <dl className="grid grid-cols-[4rem_1fr] gap-x-3 gap-y-1 text-sm">
            {addresses && (
              <>
                <dt className="text-text-muted">{email.to.length ? 'To' : 'Bcc'}</dt>
                <dd className="break-all text-text-primary">{addresses}</dd>
              </>
            )}
            <dt className="text-text-muted">Subject</dt>
            <dd className="text-text-primary">{email.subject}</dd>
          </dl>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-secondary/50 p-3 font-sans text-sm text-text-primary">
            {email.body}
          </pre>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={primaryButton} onClick={() => copy('email', email.body)}>
              {copied === 'email' ? <IconCheck size={15} /> : <IconCopy size={15} />} Copy email text
            </button>
            {addresses && (
              <button type="button" className={secondaryButton} onClick={() => copy('addresses', addresses)}>
                {copied === 'addresses' ? <IconCheck size={15} /> : <IconCopy size={15} />} Addresses
              </button>
            )}
            <button type="button" className={secondaryButton} onClick={() => copy('subject', email.subject)}>
              {copied === 'subject' ? <IconCheck size={15} /> : <IconCopy size={15} />} Subject
            </button>
            {mailto.length <= MAILTO_LIMIT && (
              <a href={mailto} className={secondaryButton} onClick={markSent}>
                <IconMail size={15} /> Open in mail
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CopyTextCard;
