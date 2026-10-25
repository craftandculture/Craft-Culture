'use client';

import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import type { UaeArrivalRateCard } from '../../schemas/uaeArrivalRateCardSchema';
import { card, input, primaryButton, secondaryButton, sectionHeading } from '../exports/exportUi';

type Line = UaeArrivalRateCard['lines'][number];
type Variable = UaeArrivalRateCard['variables'][number];

const aed = (n: number) => `AED ${n.toLocaleString('en-GB')}`;

const coversLabel: Record<Line['covers'], string> = { customs: 'Customs', handling: 'Handling' };
const modesLabel: Record<Line['modes'], string> = { all: 'Air and sea', air: 'Air only', sea: 'Sea only' };

/**
 * The UAE customs and handling charges added to every freight quote into the UAE
 *
 * Closed, it says what a shipment costs to land by air and by sea. Open, each
 * charge can be changed, added or removed; saving reprices every quote.
 * Charges that apply only sometimes are kept apart and never added.
 */
const UaeArrivalCostsCard = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useQuery(api.logistics.admin.quotes.arrivalRateCard.queryOptions());
  const [draft, setDraft] = useState<UaeArrivalRateCard | null>(null);

  const save = useMutation({
    ...api.logistics.admin.quotes.setArrivalRateCard.mutationOptions(),
    onSuccess: () => {
      toast.success('UAE arrival costs saved; quotes repriced');
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin']] });
    },
    onError: (error) => toast.error(error.message || 'The costs were not saved'),
  });

  if (!data) return null;

  const totalFor = (mode: 'air' | 'sea') =>
    data.lines.filter((l) => l.modes === 'all' || l.modes === mode).reduce((s, l) => s + l.amountAed, 0);

  const setLine = (i: number, patch: Partial<Line>) =>
    setDraft((d) => d && { ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const setVariable = (i: number, patch: Partial<Variable>) =>
    setDraft((d) => d && { ...d, variables: d.variables.map((v, j) => (j === i ? { ...v, ...patch } : v)) });

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
        <span className={sectionHeading}>UAE arrival costs</span>
        <span className="text-xs text-text-muted">
          Added to every quote into the UAE: {aed(totalFor('air'))} per air shipment, {aed(totalFor('sea'))} per sea
          shipment
          {data.isDefault ? ' (from the GAC invoice)' : ''}
        </span>
        {!draft && (
          <button
            type="button"
            className={`${secondaryButton} ml-auto`}
            onClick={() => setDraft({ lines: data.lines, variables: data.variables })}
          >
            Edit
          </button>
        )}
      </div>

      {draft && (
        <div className="space-y-4 border-t border-border-muted px-4 py-3">
          <div className="space-y-2">
            {draft.lines.map((l, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  className={`${input} min-w-0 flex-1`}
                  value={l.label}
                  onChange={(e) => setLine(i, { label: e.target.value })}
                  aria-label="Charge"
                />
                <input
                  className={`${input} w-28 text-right tabular-nums`}
                  inputMode="decimal"
                  value={l.amountAed}
                  onChange={(e) => setLine(i, { amountAed: Number(e.target.value) || 0 })}
                  aria-label="Amount, AED"
                />
                <select
                  className={`${input} w-32`}
                  value={l.covers}
                  onChange={(e) => setLine(i, { covers: e.target.value as Line['covers'] })}
                  aria-label="Kind of charge"
                  title="A quote that already has a line of this kind is not charged it again"
                >
                  {Object.entries(coversLabel).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <select
                  className={`${input} w-32`}
                  value={l.modes}
                  onChange={(e) => setLine(i, { modes: e.target.value as Line['modes'] })}
                  aria-label="Applies to"
                >
                  {Object.entries(modesLabel).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="text-text-muted hover:text-text-primary"
                  aria-label="Remove charge"
                  onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, j) => j !== i) })}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={secondaryButton}
              onClick={() =>
                setDraft({
                  ...draft,
                  lines: [...draft.lines, { label: '', amountAed: 0, covers: 'handling', modes: 'all' }],
                })
              }
            >
              <IconPlus size={15} /> Add a charge
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-text-muted">Only when it happens (shown with the price, never added)</p>
            {draft.variables.map((v, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  className={`${input} min-w-0 flex-1`}
                  value={v.label}
                  onChange={(e) => setVariable(i, { label: e.target.value })}
                  aria-label="Charge"
                />
                <input
                  className={`${input} w-28 text-right tabular-nums`}
                  inputMode="decimal"
                  value={v.amountAed}
                  onChange={(e) => setVariable(i, { amountAed: Number(e.target.value) || 0 })}
                  aria-label="Amount, AED"
                />
                <input
                  className={`${input} w-32`}
                  value={v.per}
                  onChange={(e) => setVariable(i, { per: e.target.value })}
                  aria-label="Charged per"
                  placeholder="per document"
                />
                <button
                  type="button"
                  className="text-text-muted hover:text-text-primary"
                  aria-label="Remove charge"
                  onClick={() => setDraft({ ...draft, variables: draft.variables.filter((_, j) => j !== i) })}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={secondaryButton}
              onClick={() =>
                setDraft({ ...draft, variables: [...draft.variables, { label: '', amountAed: 0, per: 'document' }] })
              }
            >
              <IconPlus size={15} /> Add one
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className={primaryButton}
              disabled={save.isPending || draft.lines.some((l) => !l.label.trim())}
              onClick={() =>
                save.mutate({
                  lines: draft.lines,
                  variables: draft.variables.filter((v) => v.label.trim()),
                })
              }
            >
              Save
            </button>
            <button type="button" className={secondaryButton} onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UaeArrivalCostsCard;
