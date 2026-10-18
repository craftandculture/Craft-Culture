'use client';

import { IconBrandWhatsapp, IconCheck, IconPlane, IconShip, IconTruck } from '@tabler/icons-react';
import type { inferRouterOutputs } from '@trpc/server';
import { format } from 'date-fns';
import { useState } from 'react';

import type { AppRouter } from '@/trpc-router';

import TransferInstructions from './TransferInstructions';
import intakeStages from '../constants/intakeStages';
import wineSources from '../constants/wineSources';

type Intake = inferRouterOutputs<AppRouter>['onboarding']['member']['overview']['intakes'][number];

export interface IncomingTransferCardProps {
  intake: Intake;
  /** The member's reference, quoted on wine sent to our UK bond */
  reference: string | null;
}

const WINES_SHOWN = 4;

const transportLabel = (mode: string) => {
  if (mode === 'air') return { label: 'By air', Icon: IconPlane };
  if (mode === 'road') return { label: 'By road', Icon: IconTruck };
  return { label: 'By sea', Icon: IconShip };
};

const bottleLabel = (bottleSizeMl: number) =>
  bottleSizeMl === 750 ? '' : bottleSizeMl >= 1000 ? ` (${bottleSizeMl / 1000}L)` : ` (${bottleSizeMl / 10}cl)`;

/**
 * One transfer on its way into a member's cellar
 *
 * The tracker runs across the card on a wide screen and down it on a phone.
 * Once the team links the shipment carrying it, the card shows the member's
 * own wines on board and when they are expected.
 */
const IncomingTransferCard = ({ intake, reference }: IncomingTransferCardProps) => {
  const [showAll, setShowAll] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const at = intakeStages.findIndex((stage) => stage.value === intake.stage);
  const source = wineSources.find((item) => item.value === intake.source);
  const title = intake.holderName && intake.source !== 'lcb' ? intake.holderName : (source?.label ?? 'Your wine');
  const shipment = intake.shipment;
  const wines = shipment?.wines ?? [];
  const shown = showAll ? wines : wines.slice(0, WINES_SHOWN);
  const transport = shipment ? transportLabel(shipment.transportMode) : null;

  const facts = [
    shipment && shipment.cases > 0
      ? `${shipment.cases} ${shipment.cases === 1 ? 'case' : 'cases'}`
      : intake.approxCases
        ? `About ${intake.approxCases} cases`
        : null,
    shipment?.arrivedAt
      ? `Arrived ${format(new Date(shipment.arrivedAt), 'd MMM')}`
      : shipment?.eta
        ? `Expected ${format(new Date(shipment.eta), 'd MMM')}`
        : null,
  ].filter(Boolean);

  return (
    <article className="border-border-muted bg-surface-primary rounded-xl border p-4 shadow-sm sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-text-muted text-[11px] font-semibold uppercase tracking-wider">Incoming</p>
          <h3 className="text-text-primary mt-0.5 truncate text-base font-semibold">{title}</h3>
          {(facts.length > 0 || transport) && (
            <p className="text-text-muted mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
              {transport && (
                <span className="inline-flex items-center gap-1">
                  <transport.Icon size={13} /> {transport.label}
                </span>
              )}
              {facts.map((fact) => (
                <span key={fact}>{fact}</span>
              ))}
            </p>
          )}
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900">
          {intakeStages[Math.max(at, 0)]?.label}
        </span>
      </header>

      {/* Across on a wide screen */}
      <ol className="mt-5 hidden grid-cols-5 sm:grid">
        {intakeStages.map((stage, index) => (
          <li key={stage.value} className="relative flex flex-col items-center text-center">
            {index > 0 && (
              <span
                className={`absolute right-1/2 top-2 h-0.5 w-full -translate-y-1/2 ${index <= at ? 'bg-emerald-500' : 'bg-border-muted'}`}
              />
            )}
            <span
              className={`relative z-10 flex size-4 items-center justify-center rounded-full ${
                index <= at ? 'bg-emerald-500 text-white' : 'border-border-muted bg-surface-primary border-2'
              }`}
            >
              {index <= at && <IconCheck size={10} stroke={3} />}
            </span>
            <span
              className={`mt-2 px-1 text-[11px] leading-tight ${index === at ? 'text-text-primary font-semibold' : 'text-text-muted'}`}
            >
              {stage.label}
            </span>
          </li>
        ))}
      </ol>

      {/* Down on a phone */}
      <ol className="mt-4 space-y-2 sm:hidden">
        {intakeStages.map((stage, index) => (
          <li key={stage.value} className="flex items-center gap-2.5 text-sm">
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                index <= at ? 'bg-emerald-500 text-white' : 'border-border-muted border-2'
              }`}
            >
              {index <= at && <IconCheck size={11} stroke={3} />}
            </span>
            <span className={index === at ? 'text-text-primary font-semibold' : 'text-text-muted'}>{stage.label}</span>
          </li>
        ))}
      </ol>

      {wines.length > 0 && (
        <div className="border-border-muted mt-5 border-t pt-3">
          <p className="text-text-muted mb-1.5 text-[11px] font-semibold uppercase tracking-wider">On board</p>
          <ul className="divide-border-muted divide-y text-sm">
            {shown.map((wine, index) => (
              <li key={`${wine.name}-${wine.vintage}-${index}`} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="text-text-primary min-w-0">
                  {wine.vintage ? `${wine.vintage} ` : ''}
                  {wine.name}
                  <span className="text-text-muted">{bottleLabel(wine.bottleSizeMl)}</span>
                </span>
                <span className="text-text-muted shrink-0 text-xs tabular-nums">
                  {wine.cases} × {wine.bottlesPerCase}
                </span>
              </li>
            ))}
          </ul>
          {wines.length > WINES_SHOWN && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="text-text-primary mt-1 text-xs font-semibold underline underline-offset-2"
            >
              {showAll ? 'Show fewer' : `Show all ${wines.length} wines`}
            </button>
          )}
        </div>
      )}

      {/*
        Until the wine has arrived, the details to pass on stay a click away:
        a member chasing a slow merchant wants them again, and the reference
        is easy to lose.
      */}
      {source?.isTransfer && (intake.stage === 'requested' || intake.stage === 'in_progress') && (
        <div className="border-border-muted mt-4 border-t pt-3">
          <button
            type="button"
            onClick={() => setShowHow(!showHow)}
            aria-expanded={showHow}
            className="text-text-primary text-xs font-semibold underline underline-offset-2"
          >
            {showHow ? 'Hide the details to pass on' : 'Details to pass on to the merchant'}
          </button>
          {showHow && (
            <div className="mt-3">
              <TransferInstructions source={intake.source} reference={reference} />
            </div>
          )}
        </div>
      )}

      <footer className="mt-4 flex justify-end">
        <a
          href={`https://wa.me/971581498156?text=${encodeURIComponent(`Hello, a question about my wine coming in from ${title}.`)}`}
          target="_blank"
          rel="noreferrer"
          className="text-text-muted hover:text-text-primary inline-flex items-center gap-1 text-xs font-semibold"
        >
          <IconBrandWhatsapp size={14} /> Ask about this
        </a>
      </footer>
    </article>
  );
};

export default IncomingTransferCard;
