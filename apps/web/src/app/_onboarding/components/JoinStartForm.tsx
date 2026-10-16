'use client';

import {
  IconArrowLeft,
  IconArrowRight,
  IconListDetails,
  IconLock,
  IconMail,
  IconMailOpened,
  IconTemperature,
  IconWorld,
} from '@tabler/icons-react';
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
      <div className="bg-fill-primary border-border-muted mx-auto max-w-md space-y-5 rounded-2xl border p-7 text-center shadow-sm">
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

  const points = [
    {
      icon: IconTemperature,
      title: 'Cellared duty-free at 12–14°C',
      detail:
        'In the C&C bonded warehouse, humidity controlled and monitored around the clock. Duty and VAT are only paid when wine is delivered to you.',
    },
    {
      icon: IconWorld,
      title: 'Collected from your merchants',
      detail:
        'We arrange collection from your merchants and bonded warehouses in the UK and Europe, and ship it to your cellar in the UAE.',
    },
    {
      icon: IconListDetails,
      title: 'Your whole collection in one place',
      detail: 'Every case you hold, on record. Buy from our cellar, sell, or arrange a delivery whenever you wish.',
    },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-x-14 lg:gap-y-10">
      <div className="space-y-4 lg:col-start-1">
        {greeting ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900">
            <Icon icon={IconMailOpened} size="xs" />
            {greeting.inviterName ? `An invitation from ${greeting.inviterName}` : 'You have been invited'}
          </span>
        ) : (
          <span className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.18em]">
            By application
          </span>
        )}
        <h1 className="font-heading text-text-primary text-4xl leading-tight tracking-tight sm:text-5xl">
          {greeting ? `Welcome, ${greeting.name.split(' ')[0]}.` : 'Open your Private Cellar account'}
        </h1>
        <p className="text-text-muted max-w-xl text-base leading-7 sm:text-lg sm:leading-8">
          A private cellar with Craft &amp; Culture: your wine kept duty-free in our bonded warehouse, collected from
          your merchants abroad, and every case on record.
        </p>
      </div>

      {/*
        The card sits beside the welcome on a wide screen and straight after it
        on a phone, so the one thing to do is never below the fold.
      */}
      <form
        onSubmit={send}
        className="bg-fill-primary border-border-muted h-fit space-y-4 rounded-2xl border p-6 shadow-lg shadow-black/5 sm:p-7 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center"
      >
        <div>
          <p className="text-text-primary text-lg font-semibold">
            {greeting ? 'Accept your invitation' : 'Begin your application'}
          </p>
          <p className="text-text-muted mt-0.5 text-sm">It takes a few minutes, and you can finish later.</p>
        </div>
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
        <button
          type="submit"
          disabled={isSending}
          className="bg-text-primary text-surface-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold transition-opacity disabled:opacity-50"
        >
          {isSending ? 'Sending…' : 'Send my sign-in link'}
          {!isSending && <Icon icon={IconArrowRight} size="sm" />}
        </button>
        <p className="text-text-muted flex items-center justify-center gap-1.5 text-center text-xs">
          <Icon icon={IconLock} size="xs" /> No password needed. We email you a secure link.
        </p>
      </form>

      <ul className="grid gap-3 sm:grid-cols-3 lg:col-start-1 lg:grid-cols-1">
        {points.map((point) => (
          <li key={point.title} className="flex gap-3.5">
            <span className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900">
              <Icon icon={point.icon} size="sm" />
            </span>
            <div>
              <p className="text-text-primary text-sm font-semibold">{point.title}</p>
              <p className="text-text-muted mt-0.5 text-sm leading-6">{point.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default JoinStartForm;
