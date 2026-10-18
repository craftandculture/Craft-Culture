'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import ConfirmAction from '../ConfirmAction';

/**
 * Everyone members have shared their cellars with
 *
 * Staff can see each delegate, their level and whether they have accepted,
 * and remove access when a holder asks by phone or email.
 */
const SharedAccessList = () => {
  const api = useTRPC();

  const { data, isLoading, refetch } = useQuery({
    ...api.cellar.access.adminList.queryOptions(),
  });

  const { mutate: revoke, isPending } = useMutation(
    api.cellar.access.adminRevoke.mutationOptions({
      onSuccess: (result) => {
        toast.success(`${result.name}'s access removed`);
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const people = data?.people ?? [];
  const active = people.filter((person) => person.status === 'active').length;
  const pending = people.length - active;

  return (
    <div>
      <p className="text-text-muted mb-5 text-sm">
        People members have given access to their private cellar. Holders
        manage this themselves from their profile; remove access here only when
        a holder asks you to.
      </p>

      <dl className="mb-5 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-500/10">
          <dt className="text-text-muted text-xs">With access</dt>
          <dd className="text-text-primary m-0 text-xl font-semibold tabular-nums">
            {active}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-500/10">
          <dt className="text-text-muted text-xs">Invitations open</dt>
          <dd className="text-text-primary m-0 text-xl font-semibold tabular-nums">
            {pending}
          </dd>
        </div>
      </dl>

      {isLoading && <p className="text-text-muted text-sm">Loading…</p>}

      {!isLoading && people.length === 0 && (
        <div className="border-border-muted rounded-xl border px-6 py-12 text-center">
          <p className="text-text-muted text-sm">
            No member has shared their cellar yet.
          </p>
        </div>
      )}

      {people.length > 0 && (
        <ul className="divide-border-muted border-border-muted divide-y rounded-xl border">
          {people.map((person) => (
            <li
              key={person.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-text-primary text-sm font-semibold">
                  {person.name}{' '}
                  <span className="text-text-muted font-normal">
                    in {person.holderName}&rsquo;s cellar
                  </span>
                </p>
                <p className="text-text-muted text-xs">
                  {person.email} ·{' '}
                  {person.status === 'active'
                    ? `accepted ${format(new Date(person.acceptedAt ?? person.createdAt), 'd MMM yyyy')}`
                    : new Date(person.expiresAt) < new Date()
                      ? 'invitation expired'
                      : 'invited, not yet accepted'}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    person.role === 'manager'
                      ? 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-900'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300'
                  }`}
                >
                  {person.role === 'manager' ? 'Manage' : 'View only'}
                </span>
                <ConfirmAction
                  title={`Remove ${person.name}'s access?`}
                  description={
                    <p>
                      They will no longer see {person.holderName}&rsquo;s
                      private cellar, from their next visit. Both of them are
                      told.
                    </p>
                  }
                  confirmLabel="Remove access"
                  tone="danger"
                  onConfirm={() => revoke({ grantId: person.id })}
                >
                  <button
                    type="button"
                    disabled={isPending}
                    className="border-border-muted text-text-primary h-8 rounded-full border px-3 text-xs font-semibold disabled:opacity-50"
                  >
                    Remove
                  </button>
                </ConfirmAction>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SharedAccessList;
