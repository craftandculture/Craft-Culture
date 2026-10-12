'use client';

import { IconArrowLeft, IconArrowRight, IconMail } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import authBrowserClient from '@/lib/better-auth/browser';

export interface JoinStartFormProps {
  /** An invite token from the invitation email, carried through sign-in */
  invite?: string | null;
  /** Who invited them and the name we have for them, when the invite is valid */
  greeting?: { name: string; inviterName: string | null; email: string } | null;
}

/**
 * Start a Private Cellar membership: an email, then a sign-in link
 *
 * No password and no form to fill before they are in — the application itself
 * comes after the link, where it can be saved and finished later. The link
 * lands on the application whether the account is new or existing, so a
 * returning person picks up where they left off.
 */
const JoinStartForm = ({ invite, greeting }: JoinStartFormProps) => {
  const [email, setEmail] = useState(greeting?.email ?? '');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const target = `/join/application${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`;

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const address = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSending(true);
    const { error } = await authBrowserClient.signIn.magicLink({
      email: address,
      callbackURL: target,
      newUserCallbackURL: target,
    });
    setIsSending(false);

    if (error) {
      toast.error(error.message ?? 'Could not send the link — please try again');
      return;
    }

    setSentTo(address);
  };

  if (sentTo) {
    return (
      <div className="bg-fill-primary border-border-muted space-y-5 rounded-2xl border p-7 text-center shadow-sm">
        <span className="bg-text-primary/10 text-text-primary underline-offset-2 mx-auto flex size-14 items-center justify-center rounded-full">
          <Icon icon={IconMail} size="lg" />
        </span>
        <h1 className="font-heading text-text-primary text-2xl">Check your email</h1>
        <p className="text-text-muted text-sm leading-6">
          We have sent a secure link to{' '}
          <span className="text-text-primary font-semibold">{sentTo}</span>.
          <br />
          Open it on this device to continue your application.
        </p>
        <Button variant="ghost" size="md" onClick={() => setSentTo(null)}>
          <ButtonContent iconLeft={IconArrowLeft}>Use a different email</ButtonContent>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        {greeting ? (
          <>
            <p className="text-text-primary underline-offset-2 text-sm font-semibold">
              {greeting.inviterName
                ? `${greeting.inviterName} has invited you`
                : 'You have been invited'}
            </p>
            <h1 className="font-heading text-text-primary text-3xl leading-tight">
              Welcome, {greeting.name.split(' ')[0]}.
            </h1>
          </>
        ) : (
          <h1 className="font-heading text-text-primary text-3xl leading-tight">
            Open your Private Cellar account
          </h1>
        )}
        <p className="text-text-muted text-base leading-7">
          A professional account for private collectors: bonded storage in the
          UAE, international sourcing and consolidation, and a complete record of
          every case you hold. Membership is by application.
        </p>
      </div>

      <form
        onSubmit={send}
        className="bg-fill-primary border-border-muted space-y-4 rounded-2xl border p-6 shadow-sm"
      >
        <label className="block space-y-2">
          <span className="text-text-primary text-sm font-semibold">Your email</span>
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            autoFocus={!greeting}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="border-border-primary bg-fill-primary text-text-primary placeholder:text-text-muted/60 focus:border-text-primary h-12 w-full rounded-xl border px-4 text-base outline-none transition-colors"
          />
        </label>
        <Button type="submit" size="lg" colorRole="bold" className="w-full" isDisabled={isSending}>
          <ButtonContent iconRight={IconArrowRight} isLoading={isSending}>
            Send my sign-in link
          </ButtonContent>
        </Button>
        <p className="text-text-muted text-center text-xs">
          We will email you a secure link to begin your application.
        </p>
      </form>
    </div>
  );
};

export default JoinStartForm;
