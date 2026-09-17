'use client';

import {
  IconAlertTriangle,
  IconFileInvoice,
  IconPlus,
  IconUnlink,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import LinkZohoCustomerDialog from '@/app/_partners/components/LinkZohoCustomerDialog';
import Button from '@/app/_ui/components/Button/Button';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogFooter from '@/app/_ui/components/Dialog/DialogFooter';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

export interface ZohoSalesOrderButtonProps {
  orderId: string;
  zohoSalesOrderNumber: string | null;
  /** True once an order has been raised — 'pending' while one is being raised */
  hasSalesOrder: boolean;
}

const money = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

/**
 * Raise the Zoho sales order for a private client order
 *
 * One press where every item code already exists, and a confirmation where any
 * would have to be created — a created code is permanent in the catalogue the
 * accounts read, and the thing worth catching is a pack recorded wrongly on the
 * line, which reads plainly as a name and not at all as an LWIN.
 *
 * The totals are shown side by side deliberately. The Zoho order bills the
 * distributor at in-bond trade; the PCO total is what the end client pays, with
 * the distributor's margin and VAT on top. They are supposed to differ, and
 * seeing them together once is cheaper than wondering about it later.
 */
const ZohoSalesOrderButton = ({
  orderId,
  zohoSalesOrderNumber,
  hasSalesOrder,
}: ZohoSalesOrderButtonProps) => {
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  const [preview, setPreview] =
    useState<Awaited<
      ReturnType<
        typeof trpcClient.privateClientOrders.adminPreviewZohoSalesOrder.query
      >
    > | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  /*
    The one blocker that is a missing link rather than a mistake, and the one
    worth answering here: the distributor has no Zoho customer. Explaining it
    and leaving would send someone to another screen to do a thing they could
    do on the spot.
  */
  const [linking, setLinking] = useState<{
    partnerId: string;
    partnerName: string;
  } | null>(null);

  const { mutate: create, isPending: isCreating } = useMutation({
    ...api.privateClientOrders.adminCreateZohoSalesOrder.mutationOptions(),
    onSuccess: (result) => {
      setPreview(null);

      toast.success(
        `Draft sales order ${result.salesOrderNumber ?? ''} created in Zoho`.trim(),
        {
          description:
            `${result.lineCount} line${result.lineCount === 1 ? '' : 's'}, ${money(result.orderTotal)}.` +
            (result.itemsCreated.length > 0
              ? ` ${result.itemsCreated.length} new item code${result.itemsCreated.length === 1 ? '' : 's'}.`
              : '') +
            (result.unpriced.length > 0
              ? ` ${result.unpriced.length} line${result.unpriced.length === 1 ? '' : 's'} sent at zero — set the price in Zoho before invoicing.`
              : ''),
          duration: result.unpriced.length > 0 ? 20000 : 8000,
        },
      );

      void queryClient.invalidateQueries({
        queryKey: api.privateClientOrders.adminGetOne.queryKey({ id: orderId }),
      });
    },
    onError: (error) => {
      toast.error('Could not raise the sales order', {
        description: error.message,
        duration: 15000,
      });
    },
  });

  const { mutate: unlink, isPending: isUnlinking } = useMutation({
    ...api.privateClientOrders.adminUnlinkZohoSalesOrder.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`${result.unlinked} unlinked from this order`, {
        description:
          'It still exists in Zoho — delete or void it there if you meant to ' +
          'replace it, or the next press will raise a second one alongside it.',
        duration: 15000,
      });

      void queryClient.invalidateQueries({
        queryKey: api.privateClientOrders.adminGetOne.queryKey({ id: orderId }),
      });
    },
    onError: (error) => {
      toast.error('Could not unlink', { description: error.message });
    },
  });

  /*
    The preview is asked for on the press rather than kept fresh in the
    background: it costs a Zoho lookup per line against a rate-limited API, and
    nobody needs to know which codes exist until they are about to make some.
  */
  const handleClick = async () => {
    setIsChecking(true);

    try {
      const result =
        await trpcClient.privateClientOrders.adminPreviewZohoSalesOrder.query({
          orderId,
        });

      if (result.blockers.length > 0) {
        if (result.needsZohoContact && result.blockers.length === 1) {
          setLinking(result.needsZohoContact);

          return;
        }

        toast.error('Cannot raise a sales order yet', {
          description: result.blockers.join(' '),
          duration: 15000,
        });

        return;
      }

      // Nothing new and nothing unpriced is a press with no question in it
      if (!result.needsConfirmation) {
        create({ orderId, confirmed: true });

        return;
      }

      setPreview(result);
    } catch (error) {
      toast.error('Could not check the order against Zoho', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsChecking(false);
    }
  };

  if (hasSalesOrder) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-lg border border-border-muted bg-surface-secondary/50 py-1.5 pl-3 pr-1.5">
        <Icon icon={IconFileInvoice} size="sm" className="text-text-muted" />
        <Typography variant="bodySm" className="text-text-muted">
          Zoho SO
        </Typography>
        <Typography variant="bodySm" className="font-medium">
          {zohoSalesOrderNumber ?? 'raised'}
        </Typography>
        {/*
          The way back. Raising writes the id here so a second press cannot
          duplicate it, and without this that guard has no counterpart: an
          order deleted in Zoho left the PCO pointing at nothing, refusing to
          raise another, recoverable only with a hand on the database.
        */}
        <Button
          variant="ghost"
          size="sm"
          title="Unlink this sales order so another can be raised. Nothing is deleted in Zoho."
          onClick={() => unlink({ orderId })}
          disabled={isUnlinking}
        >
          <Icon icon={IconUnlink} size="sm" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isChecking || isCreating}
      >
        <Icon icon={IconFileInvoice} size="sm" />
        {isChecking
          ? 'Checking Zoho...'
          : isCreating
            ? 'Creating...'
            : 'Create Zoho SO'}
      </Button>

      {linking && (
        <LinkZohoCustomerDialog
          partnerId={linking.partnerId}
          partnerName={linking.partnerName}
          open
          onOpenChange={(isOpen) => !isOpen && setLinking(null)}
          onLinked={() => {
            setLinking(null);
            // Straight back to what they pressed the button for
            void handleClick();
          }}
        />
      )}

      <Dialog
        open={preview !== null}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Raise sales order in Zoho</DialogTitle>
            <DialogDescription>
              A draft for {preview?.customer?.name}, referenced{' '}
              {preview?.order.orderNumber}. Confirm and invoice it in Zoho.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {preview && preview.toCreate.length > 0 && (
              <div className="rounded-lg border border-border-muted p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <Icon icon={IconPlus} size="sm" />
                  <Typography variant="bodySm" className="font-medium">
                    {preview.toCreate.length} new item code
                    {preview.toCreate.length === 1 ? '' : 's'} will be created
                  </Typography>
                </div>
                <ul className="flex flex-col gap-1">
                  {preview.toCreate.map((name) => (
                    <li key={name}>
                      <Typography variant="bodySm" className="text-text-muted">
                        {name}
                      </Typography>
                    </li>
                  ))}
                </ul>
                <Typography
                  variant="bodyXs"
                  className="mt-2 text-text-muted"
                >
                  Check the pack on each is what the client is buying — these
                  stay in the Zoho catalogue.
                </Typography>
              </div>
            )}

            {preview && preview.unpriced.length > 0 && (
              <div className="rounded-lg border border-fill-warning/50 bg-fill-warning/5 p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <Icon
                    icon={IconAlertTriangle}
                    size="sm"
                    className="text-fill-warning"
                  />
                  <Typography variant="bodySm" className="font-medium">
                    No trade price on file — sent at zero
                  </Typography>
                </div>
                <ul className="flex flex-col gap-1">
                  {preview.unpriced.map((name) => (
                    <li key={name}>
                      <Typography variant="bodySm" className="text-text-muted">
                        {name}
                      </Typography>
                    </li>
                  ))}
                </ul>
                <Typography variant="bodyXs" className="mt-2 text-text-muted">
                  The order still goes through. Put a price on these in Zoho
                  before you invoice — the invoice is the customs value for the
                  free-zone transfer.
                </Typography>
              </div>
            )}

            {preview && preview.belowTrade.length > 0 && (
              <div className="rounded-lg border border-border-muted p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <Icon icon={IconAlertTriangle} size="sm" />
                  <Typography variant="bodySm" className="font-medium">
                    Below the cost model&rsquo;s price
                  </Typography>
                </div>
                <ul className="flex flex-col gap-1">
                  {preview.belowTrade.map((line) => (
                    <li key={line}>
                      <Typography variant="bodySm" className="text-text-muted">
                        {line}
                      </Typography>
                    </li>
                  ))}
                </ul>
                <Typography variant="bodyXs" className="mt-2 text-text-muted">
                  Not a problem if it was a deliberate price. Worth one look if
                  it was not.
                </Typography>
              </div>
            )}

            {preview && (
              <div className="flex flex-col gap-1.5 rounded-lg bg-surface-secondary/50 px-3 py-2.5">
                <div className="flex items-baseline justify-between">
                  <Typography variant="bodySm" className="font-medium">
                    Billed to {preview.customer?.name ?? 'the distributor'}
                  </Typography>
                  <Typography variant="bodyMd" className="font-medium">
                    {money(preview.orderTotal)}
                  </Typography>
                </div>
                <div className="flex items-baseline justify-between">
                  <Typography variant="bodySm" className="text-text-muted">
                    What the client pays, per the PCO
                  </Typography>
                  <Typography variant="bodySm" className="text-text-muted">
                    {money(preview.order.clientTotalUsd)}
                  </Typography>
                </div>
                <Typography variant="bodyXs" className="text-text-muted">
                  Priced at what each line was agreed at. The distributor adds
                  their margin and VAT to reach the client&rsquo;s price.
                </Typography>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => create({ orderId, confirmed: true })}
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Create draft sales order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ZohoSalesOrderButton;
