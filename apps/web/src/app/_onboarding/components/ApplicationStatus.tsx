'use client';

import {
  IconArrowRight,
  IconCheck,
  IconLoader2,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import useTRPC from '@/lib/trpc/browser';

import ContactLinks from './ContactLinks';

/**
 * Where a submitted application stands
 *
 * Checks every 30 seconds, so someone who keeps the page open sees their cellar
 * open without refreshing. Anything they skipped is listed with a way back to
 * add it — it speeds the review, but never holds it up.
 */
const ApplicationStatus = () => {
  const api = useTRPC();
  const { data, isLoading } = useQuery({
    ...api.onboarding.application.get.queryOptions(),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="text-text-muted flex justify-center py-24">
        <IconLoader2 className="animate-spin" />
      </div>
    );
  }

  const { application, missing } = data;
  const isReady = application.status === 'approved' && data.isApproved;
  const isDeclined = application.status === 'declined';
  const firstName = (application.fullName ?? '').split(' ')[0];

  if (isDeclined) {
    return (
      <div className="bg-fill-primary border-border-muted space-y-4 rounded-2xl border p-6 sm:p-7">
        <h1 className="font-heading text-text-primary text-2xl">Thank you for applying</h1>
        <p className="text-text-muted text-sm leading-6">
          We are not able to open a cellar for you at the moment.
          {application.declineReason ? ` ${application.declineReason}` : ''} If you would like to talk
          it through, we are happy to.
        </p>
        <ContactLinks />
      </div>
    );
  }

  const steps = [
    { label: 'Application received', done: true },
    { label: 'Being reviewed by our team', done: isReady, active: !isReady },
    { label: 'Your cellar is ready', done: isReady },
  ];

  return (
    <div className="bg-fill-primary border-border-muted space-y-6 rounded-2xl border p-6 sm:p-7">
      <div className="space-y-2">
        <h1 className="font-heading text-text-primary text-2xl leading-tight">
          {isReady
            ? `Your cellar is ready${firstName ? `, ${firstName}` : ''}`
            : `Thank you${firstName ? `, ${firstName}` : ''}`}
        </h1>
        <p className="text-text-muted text-sm leading-6">
          {isReady
            ? 'Have a look around — nothing is charged until you first buy, release or bring wine in.'
            : 'We have your application and will be in touch shortly, usually within one working day. We will email you the moment your cellar is open.'}
        </p>
      </div>

      <ol className="space-y-4">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-3">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${
                step.done
                  ? 'border-text-primary bg-text-primary text-surface-primary'
                  : step.active
                    ? 'border-text-primary text-text-primary underline-offset-2'
                    : 'border-border-primary text-text-muted'
              }`}
            >
              {step.done ? (
                <IconCheck size={16} stroke={3} />
              ) : step.active ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : null}
            </span>
            <span
              className={`text-sm ${step.done || step.active ? 'text-text-primary font-semibold' : 'text-text-muted'}`}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>

      {isReady ? (
        <Link href="/platform/cellar" className="block">
          <Button size="lg" colorRole="bold" className="w-full">
            <ButtonContent iconRight={IconArrowRight}>Go to my cellar</ButtonContent>
          </Button>
        </Link>
      ) : (
        missing.length > 0 && (
          <div className="border-border-muted space-y-2 rounded-xl border p-4">
            <p className="text-text-primary text-sm font-semibold">Speed things up</p>
            <p className="text-text-muted text-xs leading-5">
              You can add these now or later: {missing.join(', ')}.
            </p>
            <Link
              href="/join/application?edit=1"
              className="text-text-primary underline-offset-2 inline-flex items-center gap-1 text-sm font-semibold"
            >
              Add details <IconArrowRight size={14} />
            </Link>
          </div>
        )
      )}

      <ContactLinks />
    </div>
  );
};

export default ApplicationStatus;
