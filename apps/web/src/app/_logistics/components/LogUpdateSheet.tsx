'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Sheet from '@/app/_ui/components/Sheet/Sheet';
import SheetContent from '@/app/_ui/components/Sheet/SheetContent';
import SheetTitle from '@/app/_ui/components/Sheet/SheetTitle';
import useTRPC from '@/lib/trpc/browser';

import { SHIPMENT_STATUSES, type ShipmentStatus } from '../utils/shipmentStatuses';

/** The statuses a quick update moves between; receiving and delivery have their own screens */
const QUICK_STATUSES: ShipmentStatus[] = [
  'draft',
  'booked',
  'picked_up',
  'in_transit',
  'arrived_port',
  'customs_clearance',
  'cleared',
  'at_warehouse',
];

export interface LogUpdateSheetShipment {
  id: string;
  shipmentNumber: string;
  name: string | null;
  status: ShipmentStatus;
  eta: Date | string | null;
  etaConfirmed: boolean;
  nextAction: string | null;
  nextActionOwnerId: string | null;
}

export interface LogUpdateSheetProps {
  /** The shipment being updated; the sheet is closed when null */
  shipment: LogUpdateSheetShipment | null;
  onClose: () => void;
}

const toDateInput = (value: Date | string | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : '';

const chip = (on: boolean) =>
  `h-10 rounded-full px-3 text-sm transition-colors ${
    on ? 'bg-text-primary font-semibold text-surface-primary' : 'border border-border-muted bg-surface-primary text-text-primary'
  }`;

const UpdateForm = ({ shipment, onClose }: { shipment: LogUpdateSheetShipment; onClose: () => void }) => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<ShipmentStatus>(shipment.status);
  const [eta, setEta] = useState(toDateInput(shipment.eta));
  const [etaConfirmed, setEtaConfirmed] = useState(shipment.etaConfirmed);
  const [nextAction, setNextAction] = useState(shipment.nextAction ?? '');
  const [ownerId, setOwnerId] = useState<string | null>(shipment.nextActionOwnerId);
  const [note, setNote] = useState('');

  const { data: teamData } = useQuery(api.logistics.admin.getTeam.queryOptions());

  const save = useMutation({
    ...api.logistics.admin.logUpdate.mutationOptions(),
    onSuccess: () => {
      toast.success('Update saved');
      void queryClient.invalidateQueries({ queryKey: [['logistics']] });
      onClose();
    },
    onError: (error) => toast.error(error.message || 'Could not save the update'),
  });

  const statuses = QUICK_STATUSES.includes(shipment.status) ? QUICK_STATUSES : [shipment.status, ...QUICK_STATUSES];

  return (
    <form
      className="flex min-h-full flex-col gap-5 px-4 py-5 sm:px-5"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({
          id: shipment.id,
          status,
          eta: eta || null,
          etaConfirmed,
          nextAction: nextAction.trim() || null,
          nextActionOwnerId: ownerId,
          note: note.trim() || undefined,
        });
      }}
    >
      <div>
        <SheetTitle className="text-lg font-semibold text-text-primary">{shipment.name ?? shipment.shipmentNumber}</SheetTitle>
        <p className="mt-0.5 font-mono text-xs text-text-muted">{shipment.shipmentNumber}</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs font-semibold text-text-muted">Status</legend>
        <div className="flex flex-wrap gap-2">
          {statuses.map((key) => (
            <button key={key} type="button" onClick={() => setStatus(key)} aria-pressed={status === key} className={chip(status === key)}>
              {SHIPMENT_STATUSES.find((s) => s.key === key)?.label ?? key}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="update-eta" className="text-xs font-semibold text-text-muted">
          ETA UAE
        </label>
        <div className="flex gap-2">
          <input
            id="update-eta"
            type="date"
            value={eta}
            onChange={(event) => setEta(event.target.value)}
            className="h-11 min-w-0 flex-1 rounded-lg border border-border-muted bg-surface-primary px-3 text-sm text-text-primary"
          />
          <div className="flex overflow-hidden rounded-lg border border-border-muted" role="group" aria-label="How sure the ETA is">
            {[
              { value: false, label: 'Estimate' },
              { value: true, label: 'Confirmed' },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                disabled={!eta}
                onClick={() => setEtaConfirmed(option.value)}
                aria-pressed={etaConfirmed === option.value}
                className={`h-11 px-3 text-xs font-semibold disabled:opacity-40 ${
                  etaConfirmed === option.value
                    ? option.value
                      ? 'bg-emerald-700 text-white'
                      : 'bg-text-primary text-surface-primary'
                    : 'bg-surface-primary text-text-muted'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="update-next" className="text-xs font-semibold text-text-muted">
          Next action
        </label>
        <input
          id="update-next"
          value={nextAction}
          onChange={(event) => setNextAction(event.target.value)}
          maxLength={300}
          placeholder="e.g. Get flight schedule from Hillebrand"
          className="h-11 rounded-lg border border-border-muted bg-surface-primary px-3 text-sm text-text-primary placeholder:text-text-muted"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-muted">Owner</span>
          {(teamData?.team ?? []).map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => setOwnerId(ownerId === person.id ? null : person.id)}
              aria-pressed={ownerId === person.id}
              className={chip(ownerId === person.id)}
            >
              {person.id === teamData?.viewerId ? 'Me' : person.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="update-note" className="text-xs font-semibold text-text-muted">
          What changed (one line)
        </label>
        <textarea
          id="update-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="e.g. Hillebrand confirmed the flight; lands 04 Nov."
          className="resize-none rounded-lg border border-border-muted bg-surface-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted"
        />
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <button
          type="submit"
          disabled={save.isPending}
          className="h-12 rounded-xl bg-text-primary text-base font-semibold text-surface-primary disabled:opacity-50"
        >
          {save.isPending ? 'Saving…' : 'Save update'}
        </button>
        <p className="text-center text-xs text-text-muted">
          Adds a dated line to the shipment&rsquo;s log and restarts its &ldquo;no news&rdquo; clock.
        </p>
      </div>
    </form>
  );
};

/**
 * The ten-second shipment update
 *
 * Status, ETA (estimate or confirmed), the next action and its owner, and one
 * line on what changed, saved together. Laid out as a single column so it
 * works on a phone as well as at a desk. Saving adds a dated line to the
 * shipment's log and restarts its "no news" clock.
 */
const LogUpdateSheet = ({ shipment, onClose }: LogUpdateSheetProps) => (
  <Sheet open={Boolean(shipment)} onOpenChange={(open) => !open && onClose()}>
    <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
      {shipment && <UpdateForm key={shipment.id} shipment={shipment} onClose={onClose} />}
    </SheetContent>
  </Sheet>
);

export default LogUpdateSheet;
