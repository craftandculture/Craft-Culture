'use client';

import { IconAlertTriangle, IconExternalLink } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import AddIntakeForm from './AddIntakeForm';
import type { IntakeRoute } from '../../constants/intakeRoutes';
import intakeRoutes from '../../constants/intakeRoutes';
import type { IntakeStage } from '../../constants/intakeStages';
import wineSources from '../../constants/wineSources';
import intakeStagesFor from '../../utils/intakeStagesFor';
import isUnconfirmedIntake from '../../utils/isUnconfirmedIntake';

const selectClass =
  'border-border-muted bg-surface-primary text-text-primary h-9 w-full rounded-lg border px-2 text-xs font-semibold sm:w-auto';

/**
 * Every transfer members have asked for, and the stage it is at
 *
 * Changing the stage moves the member's Incoming card and tells them. Linking
 * the inbound shipment carrying the wine hands the later stages to the
 * shipment: as its status moves, so does the member's tracker, and their card
 * lists the wines on it assigned to them. Closed transfers are hidden unless
 * asked for.
 */
const IntakesList = () => {
  const api = useTRPC();
  const [showClosed, setShowClosed] = useState(false);
  const { data = [], refetch } = useQuery(api.onboarding.admin.listIntakes.queryOptions());
  const { data: shipments = [] } = useQuery(api.onboarding.admin.listLinkableShipments.queryOptions());

  const setStage = useMutation(
    api.onboarding.admin.setIntakeStage.mutationOptions({
      onSuccess: () => {
        toast.success('Stage updated. The member has been told');
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const setRoute = useMutation(
    api.onboarding.admin.setIntakeRoute.mutationOptions({
      onSuccess: () => {
        toast.success('Route updated');
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const linkShipment = useMutation(
    api.onboarding.admin.linkIntakeShipment.mutationOptions({
      onSuccess: ({ linked }) => {
        toast.success(linked ? 'Shipment linked. The tracker now follows it' : 'Shipment unlinked');
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const shown = data.filter(({ intake }) => showClosed || !['closed', 'in_cellar'].includes(intake.stage));

  return (
    <div className="space-y-3">
      <AddIntakeForm onAdded={() => void refetch()} />
      <label className="text-text-muted flex items-center gap-2 text-xs">
        <input type="checkbox" checked={showClosed} onChange={(event) => setShowClosed(event.target.checked)} />
        Show finished and closed
      </label>
      <div className="border-border-muted bg-surface-primary divide-border-muted divide-y rounded-xl border shadow-sm">
        {shown.length === 0 && <p className="text-text-muted px-4 py-10 text-center text-sm">No transfers in progress.</p>}
        {shown.map(({ intake, memberName, memberCode, shipment }) => {
          const isTransfer = wineSources.find((source) => source.value === intake.source)?.isTransfer;
          const linkedMissing = shipment && !shipments.some((item) => item.id === shipment.shipmentId);

          return (
            <div key={intake.id} className="hover:bg-surface-secondary/50 flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-text-primary text-sm font-semibold">
                  {memberName}
                  {memberCode && <span className="text-text-muted font-mono font-normal"> {memberCode}</span>} · {wineSources.find((source) => source.value === intake.source)?.label ?? intake.source}
                </p>
                {isUnconfirmedIntake(intake) && (
                  <p className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                    From the application, no details yet · hidden from the member until you confirm or move it on
                  </p>
                )}
                <p className="text-text-muted text-xs">
                  {[
                    intake.holderName,
                    intake.approxCases && `~${intake.approxCases} cases`,
                    intake.holderAccountRef && `acct ${intake.holderAccountRef}`,
                    intake.note,
                    intake.tastes,
                    formatDistanceToNowStrict(new Date(intake.createdAt), { addSuffix: true }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {shipment && (
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
                    <Link
                      href={`/platform/admin/logistics/shipments/${shipment.shipmentId}`}
                      className="text-text-primary inline-flex items-center gap-1 font-semibold underline underline-offset-2"
                    >
                      {shipment.shipmentNumber} <IconExternalLink size={12} />
                    </Link>
                    <span className="text-text-muted">{shipment.status.replace(/_/g, ' ')}</span>
                    {shipment.memberCases > 0 ? (
                      <span className="text-text-muted">
                        {shipment.memberCases} cases on it are {memberName}&apos;s
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
                        <IconAlertTriangle size={12} /> No lines assigned to {memberName}. Set the owner on their lines
                      </span>
                    )}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {isUnconfirmedIntake(intake) && (
                  <button
                    type="button"
                    disabled={setStage.isPending}
                    onClick={() => setStage.mutate({ intakeId: intake.id, stage: 'closed' })}
                    title="Nothing to transfer: close it without telling the member"
                    className="border-border-muted text-text-primary hover:bg-fill-muted inline-flex h-9 items-center rounded-lg border px-3 text-xs font-semibold"
                  >
                    Close
                  </button>
                )}
                {isTransfer && !shipment && shipments.length === 0 && (
                  /* Every inbound shipment is received or cancelled, so there is nothing to link yet */
                  <span className="flex items-center gap-2">
                    <span className="text-text-muted text-xs">No open shipments yet</span>
                    <Link
                      href="/platform/admin/logistics/shipments/new"
                      className="border-border-muted text-text-primary hover:bg-fill-muted inline-flex h-9 items-center rounded-lg border px-3 text-xs font-semibold"
                    >
                      New shipment
                    </Link>
                  </span>
                )}
                {isTransfer && (shipment || shipments.length > 0) && (
                  <select
                    value={shipment?.shipmentId ?? ''}
                    disabled={linkShipment.isPending}
                    onChange={(event) =>
                      linkShipment.mutate({ intakeId: intake.id, shipmentId: event.target.value || null })
                    }
                    className={`${selectClass} sm:max-w-64`}
                    aria-label="Inbound shipment"
                  >
                    <option value="">Link a shipment…</option>
                    {linkedMissing && shipment && (
                      <option value={shipment.shipmentId}>
                        {shipment.shipmentNumber} · {shipment.status.replace(/_/g, ' ')}
                      </option>
                    )}
                    {shipments.map((item) => (
                      <option key={item.id} value={item.id}>
                        {[item.shipmentNumber, item.name, item.partnerName, item.status.replace(/_/g, ' ')]
                          .filter(Boolean)
                          .join(' · ')}
                      </option>
                    ))}
                  </select>
                )}
                {isTransfer && (
                  <select
                    value={intake.route}
                    disabled={setRoute.isPending}
                    onChange={(event) =>
                      setRoute.mutate({ intakeId: intake.id, route: event.target.value as IntakeRoute })
                    }
                    className={`${selectClass} sm:max-w-56`}
                    aria-label="Route"
                    title="How the wine reaches our UAE warehouse"
                  >
                    {intakeRoutes.map((route) => (
                      <option key={route.value} value={route.value}>
                        {route.label}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={intake.stage}
                  disabled={setStage.isPending}
                  onChange={(event) =>
                    setStage.mutate({
                      intakeId: intake.id,
                      stage: event.target.value as IntakeStage,
                    })
                  }
                  className={selectClass}
                  aria-label="Stage"
                >
                  {intakeStagesFor(intake.route).map((stage) => (
                    <option key={stage.value} value={stage.value}>
                      {stage.label}
                    </option>
                  ))}
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IntakesList;
