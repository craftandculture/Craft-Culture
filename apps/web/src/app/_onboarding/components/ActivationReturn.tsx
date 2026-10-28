'use client';

import { IconCheck, IconLoader2 } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import useTRPC from '@/lib/trpc/browser';

/**
 * Back from Zoho's payment page: confirm, then return to what they were doing
 *
 * Zoho adds `hostedpage_id` to the address. A card update (`card=1`) only
 * needs the subscription re-read.
 */
const ActivationReturn = () => {
  const api = useTRPC();
  const router = useRouter();
  const params = useSearchParams();
  const hasRun = useRef(false);
  const [outcome, setOutcome] = useState<'working' | 'active' | 'pending'>('working');

  const { mutateAsync: complete } = useMutation(api.onboarding.member.completeActivation.mutationOptions());
  const { mutateAsync: refreshMembership } = useMutation(api.onboarding.member.refreshMembership.mutationOptions());

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const returnTo = params.get('return') ?? '/platform/cellar';
    const safeReturn = returnTo.startsWith('/platform/cellar') ? returnTo : '/platform/cellar';
    const hostedPageId = params.get('hostedpage_id');

    const run = async () => {
      const result =
        params.get('card') === '1' || !hostedPageId
          ? await refreshMembership()
          : await complete({ hostedPageId });

      if (result.status === 'active') {
        setOutcome('active');
        setTimeout(() => router.replace(safeReturn), 1500);
      } else {
        setOutcome('pending');
      }
    };

    run().catch(() => setOutcome('pending'));
  }, [params, complete, refreshMembership, router]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      {outcome === 'working' && <IconLoader2 className="text-text-muted animate-spin" size={28} />}
      {outcome === 'active' && (
        <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500 text-white">
          <IconCheck size={26} stroke={3} />
        </span>
      )}
      <h2 className="text-text-primary text-xl font-semibold tracking-tight">
        {outcome === 'working' && 'Confirming your membership…'}
        {outcome === 'active' && 'Your cellar is active'}
        {outcome === 'pending' && 'We are waiting to hear from the payment provider'}
      </h2>
      <p className="text-text-muted text-sm leading-6">
        {outcome === 'active' && 'Taking you back to carry on where you left off.'}
        {outcome === 'pending' &&
          'This can take a minute. Your cellar will open as soon as the payment is confirmed. You can go back now and try again shortly.'}
      </p>
      {outcome === 'pending' && (
        <button
          type="button"
          onClick={() => router.replace('/platform/cellar')}
          className="bg-text-primary text-surface-primary rounded-lg px-4 py-2 text-sm font-semibold"
        >
          Back to my cellar
        </button>
      )}
    </div>
  );
};

export default ActivationReturn;
