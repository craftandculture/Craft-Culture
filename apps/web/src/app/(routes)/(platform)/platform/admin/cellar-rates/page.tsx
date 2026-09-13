'use client';

import { IconDeviceFloppy, IconRefresh } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import priceFromRateCard, {
  type ReleaseRateCard,
} from '@/app/_cellar/utils/priceFromRateCard';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

interface RateForm extends ReleaseRateCard {
  notes: string;
}

const EMPTY_FORM: RateForm = {
  version: 'v1',
  dutyPct: 0,
  vatPct: 0,
  distributorMarginPct: 0,
  ccMarginPct: 0,
  transferPerBottle: 0,
  deliveryFlat: 0,
  deliveryPerCase: 0,
  notes: '',
};

/*
  Grouped the way the money is grouped, not the way the columns are: what the
  state takes, what the work costs, and who earns what. An operator setting a
  margin should not have to hunt for it between two handling fees.
*/
const FIELD_GROUPS: {
  title: string;
  hint: string;
  fields: { key: keyof ReleaseRateCard; label: string; suffix: string }[];
}[] = [
  {
    title: 'Duty and clearance',
    hint: 'One charge, on the declared value — what is paid at clearance is the duty',
    fields: [{ key: 'dutyPct', label: 'Duty', suffix: '%' }],
  },
  {
    title: 'VAT',
    hint: 'Applied last, to everything else on the quote',
    fields: [{ key: 'vatPct', label: 'VAT', suffix: '%' }],
  },
  {
    title: 'Handling and delivery',
    hint: 'Moving it out of the free zone, then the run itself',
    fields: [
      { key: 'transferPerBottle', label: 'Transfer, per bottle', suffix: '$' },
      { key: 'deliveryFlat', label: 'Delivery call-out, flat', suffix: '$' },
      { key: 'deliveryPerCase', label: 'Delivery, per case', suffix: '$' },
    ],
  },
  {
    title: 'Margin',
    hint: 'Both taken on the declared value, as the published card describes',
    fields: [
      { key: 'distributorMarginPct', label: 'Distributor', suffix: '%' },
      { key: 'ccMarginPct', label: 'C&C', suffix: '%' },
    ],
  },
];

const money = (value: number) =>
  `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/**
 * The rate cards releases are priced from
 *
 * A member pressing "request release" gets a figure back without anyone
 * doing arithmetic, which only holds while these numbers are right. The
 * worked example is the point of the screen: it charges a real basket through
 * the card being edited, using the same function the quote itself uses, so a
 * percentage typed in the wrong column shows up here rather than in a member's
 * inbox.
 */
const CellarRatesPage = () => {
  const api = useTRPC();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<RateForm>(EMPTY_FORM);
  const [example, setExample] = useState({
    bottles: '6',
    caseConfig: '6',
    perBottle: '150',
  });

  const { data, isLoading, refetch, isRefetching } = useQuery({
    ...api.cellar.admin.getReleaseRates.queryOptions(),
  });

  const { mutate: save, isPending } = useMutation(
    api.cellar.admin.setReleaseRates.mutationOptions({
      onSuccess: (result) => {
        toast.success(result.updated ? 'Rates updated' : 'Rate card created');
        setEditing(null);
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const houseRate = data?.houseRate ?? null;
  const members = data?.members ?? [];

  const bottles = Math.max(0, Number(example.bottles) || 0);
  const caseConfig = Math.max(1, Number(example.caseConfig) || 1);
  const perBottle = Math.max(0, Number(example.perBottle) || 0);

  /*
    Cases are rounded up from bottles exactly as the quote does it — half a
    case still gets opened, handled and carried.
  */
  const volume = {
    bottles,
    cases: Math.ceil(bottles / caseConfig),
    goodsValueUsd: bottles * perBottle,
  };

  const preview = priceFromRateCard(form, volume);

  const toForm = (
    rate: (ReleaseRateCard & { notes: string | null }) | null,
  ): RateForm | null =>
    rate
      ? {
          version: rate.version,
          dutyPct: rate.dutyPct,
          vatPct: rate.vatPct,
          distributorMarginPct: rate.distributorMarginPct,
          ccMarginPct: rate.ccMarginPct,
          transferPerBottle: rate.transferPerBottle,
          deliveryFlat: rate.deliveryFlat,
          deliveryPerCase: rate.deliveryPerCase,
          notes: rate.notes ?? '',
        }
      : null;

  /*
    A member being given their own card starts from the house rate rather than
    from zero: the usual reason to give someone a card is that one number
    differs, and starting blank invites the other eight to be set to nothing.
  */
  const openEditor = (key: string, rate: RateForm | null) => {
    setEditing(key);
    setForm(rate ?? toForm(houseRate) ?? EMPTY_FORM);
  };

  const renderEditor = (partnerId: string | null) => (
    <div className="border-border-muted bg-fill-muted/30 border-t px-4 py-4">
      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-4">
          {FIELD_GROUPS.map((group) => (
            <div key={group.title}>
              <Typography variant="bodyXs" className="font-semibold uppercase tracking-wider">
                {group.title}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mb-2 block">
                {group.hint}
              </Typography>
              <div className="grid gap-2 sm:grid-cols-3">
                {group.fields.map((field) => (
                  <label key={field.key} className="flex flex-col gap-1">
                    <span className="text-text-muted text-[11px]">
                      {field.label}
                    </span>
                    <div className="border-border-primary bg-fill-primary flex items-center rounded-lg border">
                      {field.suffix === '$' && (
                        <span className="text-text-muted pl-2.5 text-xs">$</span>
                      )}
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="text-text-primary min-h-9 w-full bg-transparent px-2 text-sm tabular-nums focus:outline-none"
                        value={String(form[field.key])}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            [field.key]: Number(event.target.value) || 0,
                          }))
                        }
                      />
                      {field.suffix === '%' && (
                        <span className="text-text-muted pr-2.5 text-xs">%</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-text-muted text-[11px]">
                Version label
              </span>
              <input
                className="border-border-primary bg-fill-primary text-text-primary min-h-9 rounded-lg border px-2.5 text-sm focus:outline-none"
                value={form.version}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    version: event.target.value,
                  }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-text-muted text-[11px]">
                Notes — why these numbers
              </span>
              <input
                className="border-border-primary bg-fill-primary text-text-primary min-h-9 rounded-lg border px-2.5 text-sm focus:outline-none"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        </div>

        <div className="border-border-muted bg-background-primary rounded-lg border p-4 lg:w-[300px]">
          <Typography variant="bodyXs" className="font-semibold uppercase tracking-wider">
            What this charges
          </Typography>
          <Typography variant="bodyXs" colorRole="muted" className="mt-0.5 mb-3 block">
            {volume.bottles} {volume.bottles === 1 ? 'bottle' : 'bottles'} ·{' '}
            {volume.cases} {volume.cases === 1 ? 'case' : 'cases'} ·{' '}
            {money(volume.goodsValueUsd)} declared
          </Typography>

          <div className="mb-3 grid grid-cols-3 gap-1.5">
            {[
              { key: 'bottles' as const, label: 'Bottles' },
              { key: 'caseConfig' as const, label: 'Per case' },
              { key: 'perBottle' as const, label: '$ / bottle' },
            ].map((field) => (
              <label key={field.key} className="flex flex-col gap-1">
                <span className="text-text-muted text-[10px]">
                  {field.label}
                </span>
                <input
                  type="number"
                  min="0"
                  className="border-border-primary bg-fill-primary text-text-primary min-h-8 rounded-md border px-2 text-xs tabular-nums focus:outline-none"
                  value={example[field.key]}
                  onChange={(event) =>
                    setExample((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>

          <dl className="flex flex-col gap-1 text-sm">
            {[
              { label: 'Duty and clearance', value: preview.dutyUsd },
              { label: 'Transfer', value: preview.transferUsd },
              { label: 'Distributor', value: preview.distributorMarginUsd },
              { label: 'Delivery', value: preview.deliveryUsd },
              { label: 'VAT', value: preview.vatUsd },
            ].map((line) => (
              <div key={line.label} className="flex justify-between">
                <dt className="text-text-muted text-xs">{line.label}</dt>
                <dd className="text-xs tabular-nums">{money(line.value)}</dd>
              </div>
            ))}
            <div className="border-border-muted mt-1 flex justify-between border-t pt-1">
              <dt className="text-text-brand text-xs font-semibold">
                C&amp;C service fee
              </dt>
              <dd className="text-text-brand text-xs font-semibold tabular-nums">
                {money(preview.serviceFeeUsd)}
              </dd>
            </div>
            <div className="border-border-muted mt-1 flex justify-between border-t pt-1.5">
              <dt className="text-sm font-semibold">Member pays</dt>
              <dd className="text-sm font-semibold tabular-nums">
                {money(preview.totalUsd)}
              </dd>
            </div>
          </dl>

          {volume.goodsValueUsd > 0 && (
            <Typography variant="bodyXs" colorRole="muted" className="mt-2 block">
              {(
                (preview.totalUsd / volume.goodsValueUsd) * 100
              ).toFixed(1)}
              % of the declared value ·{' '}
              {money(preview.totalUsd / Math.max(1, volume.bottles))} a bottle
            </Typography>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          isDisabled={isPending}
          onClick={() =>
            save({
              partnerId,
              version: form.version || 'v1',
              dutyPct: form.dutyPct,
              vatPct: form.vatPct,
              distributorMarginPct: form.distributorMarginPct,
              ccMarginPct: form.ccMarginPct,
              transferPerBottle: form.transferPerBottle,
              deliveryFlat: form.deliveryFlat,
              deliveryPerCase: form.deliveryPerCase,
              notes: form.notes || undefined,
            })
          }
        >
          <ButtonContent iconLeft={IconDeviceFloppy}>Save rates</ButtonContent>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
          <ButtonContent>Cancel</ButtonContent>
        </Button>
      </div>
    </div>
  );

  const summarise = (rate: ReleaseRateCard) =>
    [
      `${rate.dutyPct}% duty`,
      `${rate.vatPct}% VAT`,
      `${rate.distributorMarginPct}% distributor`,
      `${rate.ccMarginPct}% C&C`,
    ].join(' · ');

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Typography variant="headingLg">Release rates</Typography>
          <Typography variant="bodySm" colorRole="muted" className="mt-1 block">
            What a member is charged to bring their own wine out of bond
          </Typography>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          isDisabled={isRefetching}
        >
          <ButtonContent iconLeft={IconRefresh}>Refresh</ButtonContent>
        </Button>
      </div>

      {isLoading && (
        <Typography variant="bodySm" colorRole="muted">
          Loading rates...
        </Typography>
      )}

      {!isLoading && (
        <div className="flex flex-col gap-5">
          <div className="border-border-muted overflow-hidden rounded-xl border">
            <button
              type="button"
              onClick={() =>
                editing === 'house'
                  ? setEditing(null)
                  : openEditor('house', toForm(houseRate))
              }
              className="hover:bg-fill-muted/40 flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <Typography variant="bodySm" className="font-semibold">
                  House rate
                  {houseRate && (
                    <span className="text-text-muted ml-2 font-mono text-xs">
                      {houseRate.version}
                    </span>
                  )}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mt-0.5 block">
                  {houseRate
                    ? summarise(houseRate)
                    : 'Not set — nothing can be quoted until it is'}
                </Typography>
              </div>
              <span className="text-text-muted text-xs">
                {editing === 'house' ? 'Close' : houseRate ? 'Edit' : 'Set it'}
              </span>
            </button>
            {editing === 'house' && renderEditor(null)}
          </div>

          <div>
            <Typography variant="bodyXs" className="mb-2 block font-semibold uppercase tracking-wider">
              Members
            </Typography>
            <div className="flex flex-col gap-2">
              {members.length === 0 && (
                <div className="border-border-muted rounded-xl border px-6 py-10 text-center">
                  <Typography variant="bodySm" colorRole="muted">
                    No active members hold stock yet.
                  </Typography>
                </div>
              )}

              {members.map((member) => (
                <div
                  key={member.id}
                  className="border-border-muted overflow-hidden rounded-xl border"
                >
                  <button
                    type="button"
                    onClick={() =>
                      editing === member.id
                        ? setEditing(null)
                        : openEditor(member.id, toForm(member.rate))
                    }
                    className="hover:bg-fill-muted/40 flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <Typography variant="bodySm" className="font-semibold">
                        {member.name}
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted" className="mt-0.5 block">
                        {member.rate
                          ? `Own card (${member.rate.version}) · ${summarise(member.rate)}`
                          : 'On the house rate'}
                      </Typography>
                    </div>
                    <span className="text-text-muted flex-shrink-0 text-xs">
                      {editing === member.id
                        ? 'Close'
                        : member.rate
                          ? 'Edit'
                          : 'Give them their own'}
                    </span>
                  </button>
                  {editing === member.id && renderEditor(member.id)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CellarRatesPage;
