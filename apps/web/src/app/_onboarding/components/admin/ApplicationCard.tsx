'use client';

import { IconAlertTriangle, IconBrandWhatsapp, IconCheck, IconId } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { formatDistanceToNowStrict } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';
import type { AppRouter } from '@/trpc-router';

import ApplicationEditForm from './ApplicationEditForm';
import fieldClass from '../../constants/fieldClass';
import wineSources from '../../constants/wineSources';

export type AdminApplication = inferRouterOutputs<AppRouter>['onboarding']['admin']['listApplications'][number];

export interface ApplicationCardProps {
  row: AdminApplication;
  onChanged: () => void;
}

const statusChip: Record<string, { label: string; className: string }> = {
  draft: { label: 'Still filling in', className: 'bg-fill-muted text-text-muted' },
  submitted: { label: 'Waiting for review', className: 'bg-fill-warning text-text-warning' },
  approved: { label: 'Approved', className: 'bg-fill-success text-text-success' },
  declined: { label: 'Declined', className: 'bg-fill-danger text-text-danger' },
};

/**
 * One Private Cellar application, with everything needed to decide on it
 *
 * Gaps never block approval — they are shown so they can be chased, and
 * filled in here from WhatsApp when the member sends them.
 */
const ApplicationCard = ({ row, onChanged }: ApplicationCardProps) => {
  const api = useTRPC();
  const { application } = row;
  const [mode, setMode] = useState<'view' | 'edit' | 'decline'>('view');
  const [reason, setReason] = useState('');

  const approve = useMutation(api.onboarding.admin.approveApplication.mutationOptions());
  const decline = useMutation(api.onboarding.admin.declineApplication.mutationOptions());
  const merge = useMutation(api.onboarding.admin.mergeApplication.mutationOptions());

  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      toast.success(done);
      setMode('view');
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    }
  };

  const name = application.fullName ?? row.userName;
  const chip = statusChip[application.status] ?? statusChip.draft!;
  const whatsapp = application.phone?.replace(/[^\d]/g, '');
  const isOpen = application.status === 'submitted' || application.status === 'draft';
  const since = application.submittedAt ?? application.createdAt;

  return (
    <div className="border-border-muted space-y-4 rounded-xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Typography variant="headingSm">{name}</Typography>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip.className}`}>
              {chip.label}
            </span>
            {application.inviteId && (
              <span className="bg-fill-muted text-text-muted rounded-full px-2 py-0.5 text-[11px] font-semibold">
                Invited
              </span>
            )}
          </div>
          <Typography variant="bodyXs" colorRole="muted" className="block">
            {row.email}
            {application.phone && ` · ${application.phone}`} ·{' '}
            {formatDistanceToNowStrict(new Date(since), { addSuffix: true })}
          </Typography>
        </div>
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noreferrer"
            className="text-text-primary underline-offset-2 inline-flex items-center gap-1 text-xs font-semibold"
          >
            <IconBrandWhatsapp size={16} /> WhatsApp
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {row.missing.length === 0 ? (
          <span className="text-text-success inline-flex items-center gap-1 text-xs font-semibold">
            <IconCheck size={14} /> Profile complete
          </span>
        ) : (
          row.missing.map((item) => (
            <span key={item} className="border-border-muted text-text-muted rounded-full border px-2 py-0.5 text-xs">
              No {item.toLowerCase()}
            </span>
          ))
        )}
        {application.partnerId &&
          row.documentTypes.map((type) => (
            <a
              key={type}
              href={`/api/cellar/identity?type=${type}&partnerId=${application.partnerId}`}
              target="_blank"
              rel="noreferrer"
              className="text-text-primary underline-offset-2 inline-flex items-center gap-1 text-xs font-semibold"
            >
              <IconId size={14} /> {type === 'emirates_id_front' ? 'ID front' : type === 'emirates_id_back' ? 'ID back' : type}
            </a>
          ))}
      </div>

      {row.intakes.length > 0 && (
        <ul className="space-y-1">
          {row.intakes.map((intake) => (
            <li key={intake.id} className="text-text-primary text-sm">
              <span className="font-semibold">
                {wineSources.find((source) => source.value === intake.source)?.label ?? intake.source}
              </span>
              {intake.holderName && intake.source !== 'lcb' && ` · ${intake.holderName}`}
              {intake.approxCases ? ` · ~${intake.approxCases} cases` : ''}
              {intake.holderAccountRef && ` · acct ${intake.holderAccountRef}`}
              {(intake.note || intake.tastes) && (
                <span className="text-text-muted block text-xs">{[intake.note, intake.tastes].filter(Boolean).join(' · ')}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {row.duplicateName && (
        <div className="bg-fill-warning/40 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2">
          <span className="text-text-warning inline-flex items-center gap-1.5 text-xs font-semibold">
            <IconAlertTriangle size={14} /> Same name as existing collector “{row.duplicateName}”
          </span>
          <Button
            size="xs"
            variant="outline"
            onClick={() =>
              void run(
                () => merge.mutateAsync({ applicationId: application.id }),
                `Joined to ${row.duplicateName}`,
              )
            }
            isDisabled={merge.isPending}
          >
            <ButtonContent isLoading={merge.isPending}>It&apos;s them — merge</ButtonContent>
          </Button>
        </div>
      )}

      {application.declineReason && application.status === 'declined' && (
        <Typography variant="bodyXs" colorRole="muted" className="block">
          Reason given: {application.declineReason}
        </Typography>
      )}

      {mode === 'edit' && (
        <ApplicationEditForm
          applicationId={application.id}
          initial={{
            fullName: name,
            phone: application.phone ?? '',
            deliveryAddress: application.deliveryAddress ?? '',
            eidNumber: application.eidNumber ?? '',
            eidExpiry: application.eidExpiry ?? '',
          }}
          onDone={() => {
            setMode('view');
            onChanged();
          }}
        />
      )}

      {mode === 'decline' && (
        <div className="space-y-2">
          <textarea
            className={`${fieldClass} min-h-16 py-2 text-sm`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason (optional — shown to the applicant)"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMode('view')}>
              Cancel
            </Button>
            <Button
              size="sm"
              colorRole="danger"
              onClick={() =>
                void run(
                  () => decline.mutateAsync({ applicationId: application.id, reason }),
                  'Application declined',
                )
              }
              isDisabled={decline.isPending}
            >
              <ButtonContent isLoading={decline.isPending}>Decline application</ButtonContent>
            </Button>
          </div>
        </div>
      )}

      {mode === 'view' && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setMode('edit')}>
            Edit details
          </Button>
          {isOpen && (
            <Button size="sm" variant="ghost" onClick={() => setMode('decline')}>
              Decline
            </Button>
          )}
          {isOpen && (
            <Button
              size="sm"
              colorRole="bold"
              onClick={() =>
                void run(
                  () => approve.mutateAsync({ applicationId: application.id }),
                  `${name}'s cellar is open`,
                )
              }
              isDisabled={approve.isPending}
            >
              <ButtonContent iconLeft={IconCheck} isLoading={approve.isPending}>
                Approve
              </ButtonContent>
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default ApplicationCard;
