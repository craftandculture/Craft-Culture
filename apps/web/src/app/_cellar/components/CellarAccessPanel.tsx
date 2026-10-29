'use client';

import { IconCopy, IconUsers } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import useTRPC from '@/lib/trpc/browser';

import ConfirmAction from './ConfirmAction';
import accessLevels from '../constants/accessLevels';
import type { AccessLevel } from '../constants/accessLevels';

const levelOf = (role: string): AccessLevel =>
  role === 'manager' ? 'manager' : 'viewer';

/**
 * People with access to a private cellar
 *
 * For the holder: who they have shared their cellar with, at what level, an
 * invitation form, and removal. For someone it is shared with: whose cellar
 * it is, what they may do in it, and a way to step away.
 */
const CellarAccessPanel = () => {
  const api = useTRPC();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [level, setLevel] = useState<AccessLevel>('viewer');
  const [lastLink, setLastLink] = useState<string | null>(null);

  const { data, refetch } = useQuery({
    ...api.cellar.access.get.queryOptions(),
  });

  const { mutate: invite, isPending: isInviting } = useMutation(
    api.cellar.access.invite.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.emailed
            ? `Invitation sent to ${email}`
            : 'Invitation ready. Please send them the link below.',
        );
        setLastLink(result.acceptUrl);
        setName('');
        setEmail('');
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: change } = useMutation(
    api.cellar.access.change.mutationOptions({
      onSuccess: () => {
        toast.success('Access updated');
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: revoke } = useMutation(
    api.cellar.access.revoke.mutationOptions({
      onSuccess: (result) => {
        toast.success(`${result.name} no longer has access`);
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: leave } = useMutation(
    api.cellar.access.leave.mutationOptions({
      onSuccess: () => router.push('/'),
      onError: (error) => toast.error(error.message),
    }),
  );

  if (!data) return null;

  if (data.myRole !== 'holder') {
    const mine = levelOf(data.myRole);

    return (
      <section className="border-border-muted rounded-xl border px-4 py-4">
        <p className="text-text-primary text-sm font-semibold">Your access</p>
        <p className="text-text-muted mt-1 text-xs leading-5">
          {data.holderName} has shared their private cellar with you.{' '}
          <span className="text-text-primary font-semibold">
            {accessLevels[mine].label}.
          </span>{' '}
          {accessLevels[mine].forDelegate}
        </p>
        <ConfirmAction
          title="Stop having access?"
          description={
            <p>
              You will no longer see {data.holderName}&rsquo;s private cellar.
              They would need to invite you again.
            </p>
          }
          confirmLabel="Stop access"
          tone="danger"
          onConfirm={() => leave()}
        >
          <button
            type="button"
            className="border-border-muted text-text-primary mt-3 h-9 rounded-lg border px-3 text-xs font-semibold"
          >
            Stop having access
          </button>
        </ConfirmAction>
      </section>
    );
  }

  const canInvite = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <section className="border-border-muted rounded-xl border px-4 py-4">
      <div className="flex items-center gap-2">
        <Icon icon={IconUsers} size="sm" className="text-text-muted" />
        <p className="text-text-primary text-sm font-semibold">
          People with access
        </p>
      </div>
      <p className="text-text-muted mb-3 mt-1 text-xs leading-5">
        Share your private cellar with a spouse, family member or assistant.
        Your identification, your details and your membership always remain
        yours alone.
      </p>

      {data.people.length > 0 && (
        <ul className="divide-border-muted border-border-muted mb-4 divide-y rounded-lg border">
          {data.people.map((person) => (
            <li
              key={person.id}
              className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-text-primary text-sm font-medium">
                  {person.name}
                </p>
                <p className="text-text-muted text-xs">
                  {person.email} ·{' '}
                  {person.status === 'active'
                    ? `since ${format(new Date(person.acceptedAt ?? person.createdAt), 'd MMM yyyy')}`
                    : person.isExpired
                      ? 'invitation expired'
                      : 'invitation not yet accepted'}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <select
                  value={levelOf(person.role)}
                  onChange={(event) =>
                    change({
                      grantId: person.id,
                      role: event.target.value as AccessLevel,
                    })
                  }
                  aria-label={`Access for ${person.name}`}
                  className="border-border-muted bg-fill-primary text-text-primary h-9 rounded-lg border px-2 text-xs"
                >
                  <option value="viewer">{accessLevels.viewer.label}</option>
                  <option value="manager">{accessLevels.manager.label}</option>
                </select>
                <ConfirmAction
                  title={`Remove ${person.name}?`}
                  description={
                    <p>
                      {person.status === 'active'
                        ? `${person.name} will no longer see your private cellar, from their next visit.`
                        : 'The invitation will stop working.'}
                    </p>
                  }
                  confirmLabel="Remove"
                  tone="danger"
                  onConfirm={() => revoke({ grantId: person.id })}
                >
                  <button
                    type="button"
                    className="text-text-muted h-9 rounded px-2 text-xs font-semibold hover:text-red-700"
                  >
                    Remove
                  </button>
                </ConfirmAction>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Their name"
        />
        <Input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Their email address"
          type="email"
        />
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {(['viewer', 'manager'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setLevel(option)}
            aria-pressed={level === option}
            className={`rounded-lg border px-3 py-2 text-left transition-colors ${
              level === option
                ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-500/10'
                : 'border-border-muted hover:bg-fill-muted/40'
            }`}
          >
            <span className="text-text-primary block text-xs font-semibold">
              {accessLevels[option].label}
            </span>
            <span className="text-text-muted block text-[11px] leading-4">
              {accessLevels[option].detail}
            </span>
          </button>
        ))}
      </div>

      <ConfirmAction
        title={`Share your private cellar with ${name.trim() || 'this person'}?`}
        description={
          <p>
            {accessLevels[level].label}: {accessLevels[level].detail} You can
            change or remove this at any time.
          </p>
        }
        confirmLabel="Send invitation"
        onConfirm={() =>
          invite({ name: name.trim(), email: email.trim(), role: level })
        }
      >
        <button
          type="button"
          disabled={!canInvite || isInviting}
          className="mt-3 h-10 text-sm font-semibold disabled:opacity-50 text-emerald-700 hover:underline dark:text-emerald-400"
        >
          {isInviting ? 'Sending…' : 'Invite'}
        </button>
      </ConfirmAction>

      {lastLink && (
        <div className="border-border-muted mt-3 flex items-center gap-2 rounded-lg border px-3 py-2">
          <p className="text-text-muted min-w-0 flex-1 truncate text-xs">
            {lastLink}
          </p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard
                .writeText(lastLink)
                .then(() => toast.success('Link copied'));
            }}
            className="text-text-primary inline-flex flex-shrink-0 items-center gap-1 text-xs font-semibold"
          >
            <Icon icon={IconCopy} size="xs" />
            Copy link
          </button>
        </div>
      )}
    </section>
  );
};

export default CellarAccessPanel;
