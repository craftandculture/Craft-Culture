'use client';

import type { DialogProps } from '@radix-ui/react-dialog';
import { IconCalendar, IconCurrencyDollar, IconFileText, IconUser } from '@tabler/icons-react';
import { format } from 'date-fns';

import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogBody from '@/app/_ui/components/Dialog/DialogBody';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Divider from '@/app/_ui/components/Divider/Divider';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { Quote } from '@/database/schema';
import formatPrice from '@/utils/formatPrice';

interface QuoteDetailsDialogProps extends DialogProps {
  quote: Quote | null;
}

/**
 * Dialog component to display full quote details
 */
const QuoteDetailsDialog = ({ quote, open, onOpenChange }: QuoteDetailsDialogProps) => {
  if (!quote) return null;

  const lineItems = quote.lineItems as Array<{
    productId: string;
    offerId: string;
    quantity: number;
    vintage?: string;
  }>;

  const statusColors = {
    draft: 'text-text-muted',
    sent: 'text-text-brand',
    accepted: 'text-text-success',
    rejected: 'text-text-danger',
    expired: 'text-text-muted',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quote.name}</DialogTitle>
          <DialogDescription>
            Quote details and line items
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* Status and Date Info */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fill-muted">
                  <Icon icon={IconFileText} size="sm" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                    Status
                  </Typography>
                  <Typography variant="bodySm" className={`capitalize font-medium ${statusColors[quote.status]}`}>
                    {quote.status}
                  </Typography>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fill-muted">
                  <Icon icon={IconCalendar} size="sm" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                    Created
                  </Typography>
                  <Typography variant="bodySm" className="font-medium">
                    {format(new Date(quote.createdAt), 'MMM d, yyyy')}
                  </Typography>
                </div>
              </div>
            </div>

            {/* Client Information */}
            {(quote.clientName || quote.clientEmail || quote.clientCompany) && (
              <>
                <Divider />
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Icon icon={IconUser} size="sm" colorRole="muted" />
                    <Typography variant="bodySm" className="font-semibold">
                      Client Information
                    </Typography>
                  </div>
                  <div className="space-y-2 rounded-lg bg-fill-muted p-4">
                    {quote.clientName && (
                      <div>
                        <Typography variant="bodyXs" colorRole="muted">
                          Name
                        </Typography>
                        <Typography variant="bodySm">{quote.clientName}</Typography>
                      </div>
                    )}
                    {quote.clientEmail && (
                      <div>
                        <Typography variant="bodyXs" colorRole="muted">
                          Email
                        </Typography>
                        <Typography variant="bodySm">{quote.clientEmail}</Typography>
                      </div>
                    )}
                    {quote.clientCompany && (
                      <div>
                        <Typography variant="bodyXs" colorRole="muted">
                          Company
                        </Typography>
                        <Typography variant="bodySm">{quote.clientCompany}</Typography>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Total */}
            <Divider />
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Icon icon={IconCurrencyDollar} size="sm" colorRole="muted" />
                <Typography variant="bodySm" className="font-semibold">
                  Total Amount
                </Typography>
              </div>
              <div className="rounded-lg bg-fill-brand/10 p-4">
                <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                  Quote Total
                </Typography>
                <Typography variant="headingMd" className="font-bold text-text-brand">
                  {formatPrice(
                    quote.currency === 'AED' ? quote.totalAed ?? quote.totalUsd : quote.totalUsd,
                    quote.currency as 'USD' | 'AED',
                  )}
                </Typography>
              </div>
            </div>

            {/* Line Items */}
            <Divider />
            <div>
              <Typography variant="bodySm" className="mb-3 font-semibold">
                Line Items ({lineItems.length})
              </Typography>
              <div className="space-y-2">
                {lineItems.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-border-muted bg-background-primary p-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <Typography variant="bodyXs" colorRole="muted">
                          Product ID
                        </Typography>
                        <Typography variant="bodySm" className="font-medium">
                          {item.productId}
                        </Typography>
                      </div>
                      <div>
                        <Typography variant="bodyXs" colorRole="muted">
                          Quantity
                        </Typography>
                        <Typography variant="bodySm" className="font-medium">
                          {item.quantity}
                        </Typography>
                      </div>
                    </div>
                    {item.vintage && (
                      <div className="mt-2">
                        <Typography variant="bodyXs" colorRole="muted">
                          Vintage: {item.vintage}
                        </Typography>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {quote.notes && (
              <>
                <Divider />
                <div>
                  <Typography variant="bodySm" className="mb-2 font-semibold">
                    Notes
                  </Typography>
                  <div className="rounded-lg bg-fill-muted p-4">
                    <Typography variant="bodySm" className="whitespace-pre-wrap">
                      {quote.notes}
                    </Typography>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteDetailsDialog;
