'use client';

import { IconBrandWhatsapp, IconCopy, IconX } from '@tabler/icons-react';
import { toast } from 'sonner';

export interface InviteLinkNoticeProps {
  name: string;
  phone: string | null;
  joinUrl: string;
  emailed: boolean;
  onClose: () => void;
}

/**
 * The invitation link, shown once after sending
 *
 * Only a hash is stored, so this is the one chance to copy it. Until the
 * Loops invite template exists no email goes, and this is how it is sent.
 */
const InviteLinkNotice = ({ name, phone, joinUrl, emailed, onClose }: InviteLinkNoticeProps) => {
  const firstName = name.split(' ')[0];
  const message = `Hi ${firstName}, here is your invitation to Craft & Culture Private Cellar: ${joinUrl}`;
  const whatsapp = phone?.replace(/[^\d]/g, '');

  return (
    <div className="border-border-muted bg-surface-primary space-y-3 rounded-xl border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-text-primary text-sm font-semibold">
          {emailed
            ? `Invitation emailed to ${name}.`
            : `Invitation ready for ${name}, but the email could not be sent. Please send the link yourself.`}
        </p>
        <button type="button" onClick={onClose} className="text-text-muted" aria-label="Close">
          <IconX size={16} />
        </button>
      </div>
      <p className="bg-surface-muted text-text-muted break-all rounded-lg px-3 py-2 font-mono text-xs">{joinUrl}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(joinUrl);
            toast.success('Link copied');
          }}
          className="bg-text-primary text-surface-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
        >
          <IconCopy size={14} /> Copy link
        </button>
        <a
          href={`https://wa.me/${whatsapp ?? ''}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          className="border-border-muted bg-surface-primary text-text-primary inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm"
        >
          <IconBrandWhatsapp size={14} /> Send on WhatsApp
        </a>
      </div>
      <p className="text-text-muted text-xs">This link is shown once. Resend to make a new one.</p>
    </div>
  );
};

export default InviteLinkNotice;
