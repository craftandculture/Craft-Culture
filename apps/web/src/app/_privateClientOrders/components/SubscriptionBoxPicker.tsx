'use client';

import { IconBox } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import {
  SUBSCRIPTION_CASE_SIZES,
  SUBSCRIPTION_DEFAULT_VARIANTS,
  SUBSCRIPTION_TIERS,
} from '../constants';

export interface SubscriptionBoxPickerProps {
  /** Admin tags any partner's order; a partner only its own */
  audience: 'admin' | 'partner';
  orderId: string;
  tier: string | null;
  caseSize: number | null;
  variant: string | null;
  /** What the end client pays on this order, in AED */
  clientTotalAed: number | null;
}

const NONE = '__none__';
const OTHER = '__other__';

const aed = (value: number) =>
  `AED ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}`;

/**
 * Name the subscription box an order is
 *
 * Tier and case size come from the club's own menu; the variant is picked
 * from those already in use or typed new. Once a box is set, its club price is
 * shown beside the order's client total — the quickest check that the wines
 * chosen for a box actually add up to what the member is charged.
 */
const SubscriptionBoxPicker = ({
  audience,
  orderId,
  tier,
  caseSize,
  variant,
  clientTotalAed,
}: SubscriptionBoxPickerProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [draftTier, setDraftTier] = useState(tier ?? NONE);
  const [draftSize, setDraftSize] = useState(caseSize ? String(caseSize) : '');
  const [draftVariant, setDraftVariant] = useState(variant ?? NONE);
  const [customVariant, setCustomVariant] = useState('');

  const isAdmin = audience === 'admin';

  const adminBoxesQuery = useQuery({
    ...api.privateClientOrders.adminGetSubscriptionBoxes.queryOptions(),
    enabled: isAdmin,
  });
  const partnerBoxesQuery = useQuery({
    ...api.privateClientOrders.getSubscriptionBoxes.queryOptions(),
    enabled: !isAdmin,
  });
  const boxesUsed = (isAdmin ? adminBoxesQuery.data : partnerBoxesQuery.data) ?? [];

  const variants = [
    ...new Set([
      ...SUBSCRIPTION_DEFAULT_VARIANTS,
      ...boxesUsed.flatMap((b) => (b.variant ? [b.variant] : [])),
      ...(variant ? [variant] : []),
    ]),
  ];

  const onSaved = {
    onSuccess: () => {
      toast.success('Subscription box saved');
      void queryClient.invalidateQueries({
        queryKey: isAdmin
          ? api.privateClientOrders.adminGetOne.queryKey()
          : api.privateClientOrders.getOne.queryKey(),
      });
      void queryClient.invalidateQueries({
        queryKey: isAdmin
          ? api.privateClientOrders.adminGetSubscriptionBoxes.queryKey()
          : api.privateClientOrders.getSubscriptionBoxes.queryKey(),
      });
    },
    onError: (error: { message: string }) => toast.error(error.message),
  };

  const adminSave = useMutation(
    api.privateClientOrders.adminSetSubscriptionBox.mutationOptions(onSaved),
  );
  const partnerSave = useMutation(
    api.privateClientOrders.setSubscriptionBox.mutationOptions(onSaved),
  );
  const isPending = adminSave.isPending || partnerSave.isPending;
  const save = (input: Parameters<typeof adminSave.mutate>[0]) =>
    isAdmin ? adminSave.mutate(input) : partnerSave.mutate(input);

  const chosenVariant =
    draftVariant === OTHER
      ? customVariant.trim()
      : draftVariant === NONE
        ? ''
        : draftVariant;

  const isBox = draftTier !== NONE;
  const canSave = !isBox || (draftSize !== '' && (draftVariant !== OTHER || chosenVariant));

  const dirty =
    (isBox ? draftTier : null) !== tier ||
    (isBox && draftSize ? Number(draftSize) : null) !== caseSize ||
    (isBox ? chosenVariant || null : null) !== variant;

  const handleSave = () =>
    save({
      orderId,
      box: isBox
        ? {
            tier: draftTier,
            caseSize: Number(draftSize),
            variant: chosenVariant || undefined,
          }
        : null,
    });

  // Price check against the saved box, not the unsaved draft
  const savedTier = SUBSCRIPTION_TIERS.find((t) => t.value === tier);
  const clubPrice =
    savedTier && (caseSize === 3 || caseSize === 6)
      ? savedTier.priceAed[caseSize]
      : null;
  const difference =
    clubPrice !== null && clientTotalAed !== null ? clientTotalAed - clubPrice : null;
  const closeEnough = difference !== null && Math.abs(difference) <= clubPrice! * 0.02;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Icon icon={IconBox} size="sm" className="text-text-muted" />
          <Typography variant="bodySm" className="font-medium">
            Subscription box
          </Typography>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem_1fr_auto]">
          <Select value={draftTier} onValueChange={setDraftTier}>
            <SelectTrigger>
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not a subscription box</SelectItem>
              {SUBSCRIPTION_TIERS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={draftSize} onValueChange={setDraftSize} disabled={!isBox}>
            <SelectTrigger>
              <SelectValue placeholder="Case" />
            </SelectTrigger>
            <SelectContent>
              {SUBSCRIPTION_CASE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  Case of {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {draftVariant === OTHER ? (
            <Input
              placeholder="New variant, e.g. Red only"
              value={customVariant}
              onChange={(e) => setCustomVariant(e.target.value)}
              autoFocus
            />
          ) : (
            <Select value={draftVariant} onValueChange={setDraftVariant} disabled={!isBox}>
              <SelectTrigger>
                <SelectValue placeholder="Variant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No variant</SelectItem>
                {variants.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER}>New variant…</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Button onClick={handleSave} disabled={!dirty || !canSave || isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>

        {clubPrice !== null && (
          <Typography
            variant="bodyXs"
            className={closeEnough ? 'text-text-muted' : 'text-text-warning'}
          >
            Club price {aed(clubPrice)} · this order&rsquo;s client total{' '}
            {clientTotalAed !== null ? aed(clientTotalAed) : '—'}
            {difference !== null && !closeEnough
              ? ` · ${difference > 0 ? 'over' : 'under'} by ${aed(Math.abs(difference))}`
              : ''}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default SubscriptionBoxPicker;
