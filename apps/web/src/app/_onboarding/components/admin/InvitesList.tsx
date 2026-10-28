'use client';

import { IconSend } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import InviteLinkNotice from './InviteLinkNotice';
import fieldClass from '../../constants/fieldClass';

interface SentLink {
  name: string;
  phone: string | null;
  joinUrl: string;
  emailed: boolean;
}

const statusPill: Record<string, string> = {
  sent: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-300',
  accepted: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  expired: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300',
  revoked: 'bg-slate-50 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300',
};

/**
 * Invite a member, and every invitation sent so far
 *
 * An invited member's account and cellar exist before they sign in, so they
 * skip review and land in their cellar when they accept.
 */
const InvitesList = () => {
  const api = useTRPC();
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [sent, setSent] = useState<SentLink | null>(null);

  const { data = [], refetch } = useQuery(api.onboarding.admin.listInvites.queryOptions());
  const invite = useMutation(api.onboarding.admin.inviteMember.mutationOptions());
  const resend = useMutation(api.onboarding.admin.resendInvite.mutationOptions());
  const revoke = useMutation(api.onboarding.admin.revokeInvite.mutationOptions());

  const submit = async () => {
    try {
      const result = await invite.mutateAsync(form);
      setSent({ name: form.name, phone: form.phone || null, ...result });
      if (result.existingAccount) toast.info('They already had an account; it has been kept.');
      setForm({ name: '', email: '', phone: '' });
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not invite');
    }
  };

  const act = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      toast.success(done);
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    }
  };

  return (
    <div className="space-y-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="border-border-muted bg-surface-primary grid gap-3 rounded-xl border p-4 shadow-sm sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
      >
        {(
          [
            ['name', 'Name', 'text'],
            ['email', 'Email', 'email'],
            ['phone', 'Mobile (optional)', 'tel'],
          ] as const
        ).map(([key, label, type]) => (
          <label key={key} className="block space-y-1.5">
            <span className="text-text-muted text-[11px] font-semibold uppercase tracking-wider">{label}</span>
            <input
              type={type}
              className={`${fieldClass} h-10 text-sm`}
              value={form[key]}
              onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={invite.isPending || form.name.trim().length < 2 || !form.email.includes('@')}
          className="bg-text-primary text-surface-primary inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold disabled:opacity-40"
        >
          <IconSend size={16} /> {invite.isPending ? 'Inviting…' : 'Invite member'}
        </button>
      </form>

      {sent && <InviteLinkNotice {...sent} onClose={() => setSent(null)} />}

      <div className="border-border-muted bg-surface-primary divide-border-muted divide-y rounded-xl border shadow-sm">
        {data.length === 0 && <p className="text-text-muted px-4 py-10 text-center text-sm">No invitations yet.</p>}
        {data.map((row) => (
          <div key={row.id} className="hover:bg-surface-secondary/50 flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-text-primary text-sm font-semibold">{row.name}</p>
              <p className="text-text-muted text-xs">
                {row.email}
                {row.inviterName && ` · by ${row.inviterName.split(' ')[0]}`}
                {row.lastSentAt && ` · sent ${formatDistanceToNowStrict(new Date(row.lastSentAt), { addSuffix: true })}`}
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${statusPill[row.status] ?? ''}`}>
              {row.status}
            </span>
            {row.status !== 'accepted' && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void act(async () => {
                      const result = await resend.mutateAsync({ inviteId: row.id });
                      setSent({ name: row.name, phone: row.phone, ...result });
                    }, 'New link made')
                  }
                  className="border-border-muted bg-surface-primary text-text-primary rounded-lg border px-2.5 py-1 text-xs font-semibold shadow-sm"
                >
                  Resend
                </button>
                {row.status !== 'revoked' && (
                  <button
                    type="button"
                    onClick={() => void act(() => revoke.mutateAsync({ inviteId: row.id }), 'Invitation withdrawn')}
                    className="text-text-muted px-1 text-xs font-semibold hover:text-text-primary"
                  >
                    Revoke
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default InvitesList;
