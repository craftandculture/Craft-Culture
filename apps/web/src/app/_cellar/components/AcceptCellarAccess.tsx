'use client';

import { IconMail, IconUsers } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import Icon from '@/app/_ui/components/Icon/Icon';
import authBrowserClient from '@/lib/better-auth/browser';
import useTRPC from '@/lib/trpc/browser';

import accessLevels from '../constants/accessLevels';
import type { AccessLevel } from '../constants/accessLevels';

export interface AcceptCellarAccessProps {
  token: string;
  holderName: string;
  inviteeName: string;
  inviteeEmail: string;
  level: AccessLevel;
  /** The signed-in person's email, or null when nobody is signed in */
  signedInAs: string | null;
}

/**
 * Accepting an invitation to someone else's private cellar
 *
 * Signed out, it sends a sign-in link to the invited address and brings them
 * back here. Signed in as that address, one button accepts. Signed in as
 * anyone else, it says so rather than letting a forwarded link through.
 */
const AcceptCellarAccess = ({
  token,
  holderName,
  inviteeName,
  inviteeEmail,
  level,
  signedInAs,
}: AcceptCellarAccessProps) => {
  const api = useTRPC();
  const router = useRouter();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const back = `/cellar-access?token=${encodeURIComponent(token)}`;
  const isRightPerson =
    signedInAs !== null &&
    signedInAs.toLowerCase() === inviteeEmail.toLowerCase();

  const { mutate: accept, isPending } = useMutation(
    api.cellar.access.claim.mutationOptions({
      onSuccess: () => router.push('/platform/cellar'),
      onError: (error) => toast.error(error.message),
    }),
  );

  const sendLink = async () => {
    setIsSending(true);
    const { error } = await authBrowserClient.signIn.magicLink({
      email: inviteeEmail,
      callbackURL: back,
      newUserCallbackURL: back,
    });
    setIsSending(false);

    if (error) {
      toast.error(error.message ?? 'Could not send the link. Please try again.');
      return;
    }

    setSentTo(inviteeEmail);
  };

  return (
    <div className="bg-fill-primary border-border-muted mx-auto max-w-md space-y-5 rounded-2xl border p-7 shadow-sm">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
        <Icon icon={IconUsers} size="lg" />
      </span>
      <div className="text-center">
        <h1 className="font-heading text-text-primary text-2xl">
          {holderName}&rsquo;s private cellar
        </h1>
        <p className="text-text-muted mt-2 text-sm leading-6">
          {inviteeName}, {holderName} would like to share their private cellar
          with you.
        </p>
      </div>

      <div className="border-border-muted rounded-xl border px-4 py-3">
        <p className="text-text-primary text-sm font-semibold">
          {accessLevels[level].label}
        </p>
        <p className="text-text-muted mt-0.5 text-xs leading-5">
          {accessLevels[level].forDelegate}
        </p>
      </div>

      {sentTo ? (
        <div className="text-center">
          <span className="text-text-primary mx-auto mb-2 flex size-10 items-center justify-center">
            <Icon icon={IconMail} size="md" />
          </span>
          <p className="text-text-muted text-sm leading-6">
            We have sent a secure link to{' '}
            <span className="text-text-primary font-semibold">{sentTo}</span>.
            Open it on this device to continue.
          </p>
        </div>
      ) : isRightPerson ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => accept({ token })}
          className="bg-text-primary text-surface-primary h-11 w-full rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {isPending ? 'Opening…' : 'Accept and open the cellar'}
        </button>
      ) : signedInAs ? (
        <p className="text-text-muted text-center text-sm leading-6">
          This invitation was sent to{' '}
          <span className="text-text-primary font-semibold">{inviteeEmail}</span>
          , but you are signed in as {signedInAs}. Please sign out and open the
          link again.
        </p>
      ) : (
        <button
          type="button"
          disabled={isSending}
          onClick={sendLink}
          className="bg-text-primary text-surface-primary h-11 w-full rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {isSending ? 'Sending…' : `Send a sign-in link to ${inviteeEmail}`}
        </button>
      )}
    </div>
  );
};

export default AcceptCellarAccess;
