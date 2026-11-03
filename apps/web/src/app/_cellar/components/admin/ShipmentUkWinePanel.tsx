'use client';

import { IconBuildingWarehouse, IconDownload } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import downloadVisionLines from '../../utils/downloadVisionLines';
import ConfirmAction from '../ConfirmAction';
import QuantityStepper from '../QuantityStepper';

export interface ShipmentUkWinePanelProps {
  shipmentId: string;
  /** Refreshes the shipment once lines are added */
  onAdded: () => void;
}

const sizeLabel = (litres: number | null) => (litres ? `${Math.round(litres * 100)}cl` : '75cl');

/**
 * The shipment's client's wine at LCB Burton, to put on this shipment
 *
 * Joins the two ways UK wine reaches the UAE: a move the member asked for, and
 * freight the team arranged from a quote. Choosing lines here raises the move
 * in the member's name and adds its lines to this shipment, so the member
 * sees it on its way and receiving books it to their cellar. Shown only when
 * the client is a cellar member, on an inbound shipment.
 */
const ShipmentUkWinePanel = ({ shipmentId, onAdded }: ShipmentUkWinePanelProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const query = api.cellar.admin.getShipmentUkWine.queryOptions({ shipmentId });
  const { data } = useQuery(query);

  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [needle, setNeedle] = useState('');

  const holdings = useMemo(() => data?.holdings ?? [], [data]);
  const free = useMemo(() => holdings.filter((h) => !h.onMove && h.cases + h.singles > 0), [holdings]);
  const shown = useMemo(() => {
    const term = needle.trim().toLowerCase();
    if (!term) return holdings;
    return holdings.filter((h) =>
      `${h.name} ${h.vintage ?? ''} ${h.rotation}`.toLowerCase().includes(term),
    );
  }, [holdings, needle]);

  const add = useMutation(
    api.cellar.admin.addUkWineToShipment.mutationOptions({
      onSuccess: (move) => {
        toast.success(`${move.moveNumber} added: ${move.cases} cases. The member can now see it on its way.`);
        setChosen({});
        void queryClient.invalidateQueries({ queryKey: query.queryKey });
        onAdded();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  if (!data?.member) return null;

  const chosenIds = Object.keys(chosen);
  const chosenCases = chosenIds.reduce((sum, id) => sum + (chosen[id] ?? 0), 0);
  const freeCases = free.reduce((sum, h) => sum + h.cases, 0);
  const allChosen = free.length > 0 && free.every((h) => chosen[h.id] !== undefined);

  const toggle = (holding: (typeof holdings)[number]) =>
    setChosen((current) => {
      const next = { ...current };
      if (next[holding.id] !== undefined) delete next[holding.id];
      else next[holding.id] = holding.cases;
      return next;
    });

  const submit = () => {
    const casesByHolding = Object.fromEntries(
      chosenIds
        .map((id) => [id, chosen[id] ?? 0, holdings.find((h) => h.id === id)?.cases ?? 0] as const)
        .filter(([, wanted, held]) => wanted > 0 && wanted < held)
        .map(([id, wanted]) => [id, wanted]),
    );
    add.mutate({ shipmentId, holdingIds: chosenIds, casesByHolding });
  };

  return (
    <section className="border-border-muted bg-surface-primary mb-5 rounded-xl border">
      <div className="border-border-muted flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <IconBuildingWarehouse size={16} className="text-text-muted" />
        <span className="text-sm font-semibold">UK cellar wine · {data.member.name}</span>
        <span className="text-text-muted text-xs">
          {freeCases} {freeCases === 1 ? 'case' : 'cases'} at LCB Burton not yet on a move
        </span>
      </div>

      {data.moves.length > 0 && (
        <div className="border-border-muted divide-border-muted divide-y border-b">
          {data.moves.map((move) => (
            <div key={move.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-xs">
              <span className="font-mono font-semibold">{move.moveNumber}</span>
              <span className="text-text-muted">
                {move.items.reduce((sum, item) => sum + item.cases, 0)} cases on this shipment
                {move.memberName && move.memberName !== data.member?.name ? ` · ${move.memberName}` : ''}
              </span>
              <button
                type="button"
                onClick={() => downloadVisionLines(move)}
                className="border-border-muted ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 font-semibold"
              >
                <IconDownload size={14} />
                Vision order lines
              </button>
            </div>
          ))}
        </div>
      )}

      {holdings.length === 0 ? (
        <p className="text-text-muted px-4 py-3 text-xs">No wine at LCB Burton is placed with this member.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <input
              value={needle}
              onChange={(event) => setNeedle(event.target.value)}
              placeholder="Filter by wine, vintage or rotation"
              className="border-border-muted bg-surface-primary h-9 min-w-[220px] flex-1 rounded-lg border px-3 text-sm"
            />
            <button
              type="button"
              disabled={free.length === 0}
              onClick={() =>
                setChosen(allChosen ? {} : Object.fromEntries(free.map((h) => [h.id, h.cases])))
              }
              className="border-border-muted h-9 rounded-lg border px-3 text-xs font-semibold disabled:opacity-50"
            >
              {allChosen ? 'Clear selection' : `Select all ${freeCases} cases`}
            </button>
          </div>

          <div className="divide-border-muted max-h-[420px] divide-y overflow-y-auto border-t">
            {shown.map((holding) => {
              const isChosen = chosen[holding.id] !== undefined;
              return (
                <label
                  key={holding.id}
                  className={`flex items-center gap-3 px-4 py-2 text-sm ${holding.onMove ? 'opacity-60' : 'cursor-pointer hover:bg-fill-muted/40'}`}
                >
                  <input
                    type="checkbox"
                    disabled={!!holding.onMove}
                    checked={isChosen}
                    onChange={() => toggle(holding)}
                    className="h-4 w-4"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {holding.name} {holding.vintage ?? 'NV'}
                    </span>
                    <span className="text-text-muted block text-xs">
                      {sizeLabel(holding.bottleSizeLitres)} · {holding.bottlesPerCase ?? 1} per case · rotation{' '}
                      <span className="font-mono">{holding.rotation}</span>
                      {holding.onMove ? ` · on ${holding.onMove.moveNumber}` : ''}
                    </span>
                  </span>
                  {isChosen && holding.cases > 1 ? (
                    <span onClick={(event) => event.preventDefault()}>
                      <QuantityStepper
                        value={chosen[holding.id] ?? holding.cases}
                        min={1}
                        max={holding.cases}
                        onChange={(value) => setChosen((current) => ({ ...current, [holding.id]: value }))}
                        label={`case of ${holding.name}`}
                      />
                    </span>
                  ) : (
                    <span className="text-text-muted w-24 text-right text-xs tabular-nums">
                      {holding.cases} cs{holding.singles ? ` + ${holding.singles} btl` : ''}
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          <div className="border-border-muted flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
            <span className="text-text-muted text-xs">
              Adds the wine in {data.member.name}&apos;s name and tells them it is on its way. Then place the Vision
              export order with the move number as Your Ref.
            </span>
            <ConfirmAction
              title={`Add ${chosenCases} ${chosenCases === 1 ? 'case' : 'cases'} to this shipment?`}
              description={
                <p>
                  A UK move is raised for {data.member.name}, already accepted, and its lines are added to this
                  shipment in their name. The shipment is marked not for sale. Do not add the same wine by hand.
                </p>
              }
              confirmLabel="Add to shipment"
              onConfirm={submit}
            >
              <button
                type="button"
                disabled={chosenIds.length === 0 || add.isPending}
                className="bg-text-primary text-surface-primary h-9 rounded-lg px-4 text-xs font-semibold disabled:opacity-50"
              >
                {add.isPending ? 'Adding…' : `Add ${chosenCases} ${chosenCases === 1 ? 'case' : 'cases'}`}
              </button>
            </ConfirmAction>
          </div>
        </>
      )}
    </section>
  );
};

export default ShipmentUkWinePanel;
