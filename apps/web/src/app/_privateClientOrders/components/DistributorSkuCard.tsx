'use client';

import { IconAlertTriangle, IconBarcode, IconCheck } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import { DISTRIBUTOR_SKU_LOCKED_STATUSES } from '../constants';

export interface DistributorSkuCardProps {
  /** The distributor enters it; C&C sees where it came from and can correct it */
  audience: 'admin' | 'distributor';
  orderId: string;
  orderNumber: string;
  status: string;
  distributorName: string;
  sku: string | null;
  source: string | null;
  distributorRef: string | null;
  /** What the distributor's own feed says, for the admin mismatch warning */
  feedSku?: string | null;
  /** One line, for under the order's paperwork chain rather than a card of its own */
  compact?: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  cd_feed: 'from their system',
  distributor: 'entered by the distributor',
  admin: 'entered by C&C',
};

/**
 * The distributor's bundle SKU for one order
 *
 * City Drinks sells each PCO as a product named after the PCO number. When
 * they receive an order they create that product and record its SKU here —
 * so for them this card comes first and stays amber until it is filled. It is
 * usually filled for them already, from their own stock feed. C&C sees where
 * the SKU came from, and a warning if a typed SKU disagrees with the feed.
 */
const DistributorSkuCard = ({
  audience,
  orderId,
  orderNumber,
  status,
  distributorName,
  sku,
  source,
  distributorRef,
  feedSku,
  compact = false,
}: DistributorSkuCardProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const locked = DISTRIBUTOR_SKU_LOCKED_STATUSES.includes(status);
  const canEdit = audience === 'admin' || !locked;
  const [editing, setEditing] = useState(!sku && canEdit);
  const [value, setValue] = useState(sku ?? '');

  const onSaved = {
    onSuccess: () => {
      toast.success('SKU saved');
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
      void queryClient.invalidateQueries({
        queryKey:
          audience === 'admin'
            ? api.privateClientOrders.adminGetOne.queryKey()
            : api.privateClientOrders.distributorGetOne.queryKey(),
      });
    },
    onError: (error: { message: string }) => toast.error(error.message),
  };
  const adminSave = useMutation(
    api.privateClientOrders.adminSetDistributorSku.mutationOptions(onSaved),
  );
  const distributorSave = useMutation(
    api.privateClientOrders.distributorSetSku.mutationOptions(onSaved),
  );
  const isPending = adminSave.isPending || distributorSave.isPending;

  const save = () => {
    const input = { orderId, sku: value.trim() || null };
    if (audience === 'admin') adminSave.mutate(input);
    else distributorSave.mutate(input);
  };

  const mismatch = Boolean(sku && feedSku && sku !== feedSku);
  const missing = !sku && !locked;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`inline-flex items-center gap-1 font-medium ${missing ? 'text-amber-700 dark:text-amber-400' : 'text-text-muted'}`}>
          <Icon icon={IconBarcode} size="xs" />
          {distributorName} SKU{missing ? ' needed before payment' : ''}
        </span>
        {editing ? (
          <>
            <Input
              placeholder="CDR0824592587"
              aria-label={`${distributorName} SKU for ${orderNumber}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-44 font-mono"
              size="sm"
            />
            {/* isDisabled only styles the button; disabled stops an empty save clearing the SKU */}
            <Button
              type="button"
              size="sm"
              colorRole="bold"
              onClick={save}
              isDisabled={isPending || !value.trim()}
              disabled={isPending || !value.trim()}
            >
              {isPending ? 'Saving…' : 'Save'}
            </Button>
            {sku && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setValue(sku);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            )}
          </>
        ) : sku ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-fill-success/10 px-2 py-0.5 font-mono text-text-primary">
              <Icon icon={IconCheck} size="xs" className="text-text-success" />
              {sku}
            </span>
            {source && <span className="text-text-muted">{SOURCE_LABELS[source] ?? source}</span>}
            {canEdit && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Change
              </Button>
            )}
          </>
        ) : (
          <span className="text-text-muted">None recorded.</span>
        )}
        {mismatch && (
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
            <Icon icon={IconAlertTriangle} size="xs" />
            {distributorName}&rsquo;s system has <span className="font-mono">{feedSku}</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <Card
      className={
        missing
          ? 'border-fill-warning/60 bg-fill-warning/5'
          : mismatch
            ? 'border-fill-warning/60'
            : undefined
      }
    >
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon icon={IconBarcode} size="sm" className="text-text-muted" />
            <Typography variant="bodySm" className="font-medium">
              {distributorName} SKU for {orderNumber}
            </Typography>
          </div>
          {sku && !editing && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-fill-success/10 px-2 py-0.5 font-mono text-sm text-text-primary">
                <Icon icon={IconCheck} size="xs" className="text-text-success" />
                {sku}
              </span>
              {canEdit && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  Change
                </Button>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-2">
            {audience === 'distributor' && (
              <Typography variant="bodyXs" colorRole="muted">
                Create the bundle in your system named <span className="font-mono">{orderNumber}</span>{' '}
                and enter its SKU here. Client payment cannot be confirmed until it is recorded.
              </Typography>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="CDR0824592587"
                aria-label={`${distributorName} SKU for ${orderNumber}`}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && value.trim() && !isPending) save();
                }}
                className="min-w-0 flex-1 font-mono"
              />
              <Button type="button" colorRole="brand" onClick={save} disabled={isPending || !value.trim()}>
                {isPending ? 'Saving…' : 'Save'}
              </Button>
              {sku && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setValue(sku);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ) : !sku ? (
          <Typography variant="bodyXs" colorRole="muted">
            No SKU recorded{locked ? '.' : ' yet.'}
          </Typography>
        ) : (
          <Typography variant="bodyXs" colorRole="muted">
            {source ? SOURCE_LABELS[source] ?? source : ''}
            {distributorRef ? ` · ${distributorName} ref ${distributorRef}` : ''}
            {locked && audience === 'distributor'
              ? ' · locked once the client has paid; ask Craft & Culture to correct it'
              : ''}
          </Typography>
        )}

        {mismatch && (
          <div className="flex items-start gap-2">
            <Icon
              icon={IconAlertTriangle}
              size="sm"
              className="mt-0.5 shrink-0 text-fill-warning"
            />
            <Typography variant="bodyXs" className="text-text-muted">
              Doesn&rsquo;t match {distributorName}&rsquo;s system, which has{' '}
              <span className="font-mono text-text-primary">{feedSku}</span> for{' '}
              {orderNumber}.
            </Typography>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DistributorSkuCard;
