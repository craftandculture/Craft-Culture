'use client';

import type { DialogProps } from '@radix-ui/react-dialog';
import {
  IconCheck,
  IconEdit,
  IconPlayerPlay,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

import QuoteWorkflowTimeline from '@/app/_quotes/components/QuoteWorkflowTimeline';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogBody from '@/app/_ui/components/Dialog/DialogBody';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogFooter from '@/app/_ui/components/Dialog/DialogFooter';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Divider from '@/app/_ui/components/Divider/Divider';
import TextArea from '@/app/_ui/components/TextArea/TextArea';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { Quote } from '@/database/schema';
import { useTRPCClient } from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

interface QuoteApprovalDialogProps extends DialogProps {
  quote: Quote | null;
}

/**
 * Dialog for admins to review and take actions on quotes
 */
const QuoteApprovalDialog = ({
  quote,
  open,
  onOpenChange,
}: QuoteApprovalDialogProps) => {
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  // State for revision form
  const [revisionReason, setRevisionReason] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);

  // State for confirmation notes
  const [ccNotes, setCcNotes] = useState('');
  const [confirmationNotes, setConfirmationNotes] = useState('');

  // Start C&C Review mutation
  const startReviewMutation = useMutation({
    mutationFn: async () => {
      if (!quote) return;
      return trpcClient.quotes.startCCReview.mutate({
        quoteId: quote.id,
        ccNotes: ccNotes || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Review started successfully');
      void queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
      setCcNotes('');
      if (onOpenChange) onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        `Failed to start review: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    },
  });

  // Confirm quote mutation
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!quote) return;
      return trpcClient.quotes.confirm.mutate({
        quoteId: quote.id,
        ccConfirmationNotes: confirmationNotes || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Quote confirmed successfully');
      void queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
      setConfirmationNotes('');
      if (onOpenChange) onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        `Failed to confirm quote: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    },
  });

  // Request revision mutation
  const requestRevisionMutation = useMutation({
    mutationFn: async () => {
      if (!quote || !revisionReason.trim()) {
        toast.error('Please provide a revision reason');
        return;
      }
      return trpcClient.quotes.requestRevision.mutate({
        quoteId: quote.id,
        revisionReason,
        revisionSuggestions: {
          items: [],
        },
      });
    },
    onSuccess: () => {
      toast.success('Revision requested successfully');
      void queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
      setRevisionReason('');
      setShowRevisionForm(false);
      if (onOpenChange) onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        `Failed to request revision: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    },
  });

  // Confirm PO mutation
  const confirmPOMutation = useMutation({
    mutationFn: async () => {
      if (!quote) return;
      return trpcClient.quotes.confirmPO.mutate({
        quoteId: quote.id,
        poConfirmationNotes: confirmationNotes || undefined,
      });
    },
    onSuccess: () => {
      toast.success('PO confirmed successfully');
      void queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
      setConfirmationNotes('');
      if (onOpenChange) onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        `Failed to confirm PO: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    },
  });

  if (!quote) return null;

  const lineItems = (quote.lineItems || []) as Array<{
    productId: string;
    offerId: string;
    quantity: number;
    vintage?: string;
  }>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{quote.name}</DialogTitle>
          <DialogDescription>
            Review and approve this quote - Status: {quote.status}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* Quote Summary */}
            <div className="rounded-lg bg-fill-muted p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Client
                  </Typography>
                  <Typography variant="bodySm" className="font-medium">
                    {quote.clientName || 'N/A'}
                  </Typography>
                  {quote.clientCompany && (
                    <Typography variant="bodySm" colorRole="muted">
                      {quote.clientCompany}
                    </Typography>
                  )}
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Total Amount
                  </Typography>
                  <Typography variant="bodySm" className="font-medium">
                    {formatPrice(
                      quote.currency === 'AED' ? quote.totalAed ?? quote.totalUsd : quote.totalUsd,
                      quote.currency as 'USD' | 'AED',
                    )}
                  </Typography>
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Submitted
                  </Typography>
                  <Typography variant="bodySm">
                    {quote.buyRequestSubmittedAt
                      ? format(new Date(quote.buyRequestSubmittedAt), 'MMM d, yyyy')
                      : 'N/A'}
                  </Typography>
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Submissions
                  </Typography>
                  <Typography variant="bodySm" className="font-medium">
                    {quote.buyRequestCount}
                  </Typography>
                </div>
              </div>
            </div>

            {/* Line Items Summary */}
            <div>
              <Typography variant="bodySm" className="mb-2 font-semibold">
                Line Items ({lineItems.length})
              </Typography>
              <div className="space-y-2">
                {lineItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg bg-fill-muted/50 p-3"
                  >
                    <div>
                      <Typography variant="bodySm" className="font-mono">
                        {item.productId}
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        Quantity: {item.quantity}
                        {item.vintage && ` • Vintage: ${item.vintage}`}
                      </Typography>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Divider />

            {/* Workflow Timeline */}
            <QuoteWorkflowTimeline quote={quote} />

            <Divider />

            {/* Action Forms */}
            {quote.status === 'buy_request_submitted' && (
              <div className="space-y-4">
                <Typography variant="bodySm" className="font-semibold">
                  Start Review
                </Typography>
                <div>
                  <Typography variant="bodySm" className="mb-2">
                    Review Notes (optional)
                  </Typography>
                  <TextArea
                    id="ccNotes"
                    value={ccNotes}
                    onChange={(e) => setCcNotes(e.target.value)}
                    placeholder="Add any notes about this review..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            {quote.status === 'under_cc_review' && !showRevisionForm && (
              <div className="space-y-4">
                <Typography variant="bodySm" className="font-semibold">
                  Confirmation Notes (optional)
                </Typography>
                <TextArea
                  value={confirmationNotes}
                  onChange={(e) => setConfirmationNotes(e.target.value)}
                  placeholder="Add any notes about this confirmation..."
                  rows={3}
                />
              </div>
            )}

            {showRevisionForm && (
              <div className="space-y-4">
                <Typography variant="bodySm" className="font-semibold">
                  Request Revision
                </Typography>
                <div>
                  <Typography variant="bodySm" className="mb-2">
                    Revision Reason *
                  </Typography>
                  <TextArea
                    id="revisionReason"
                    value={revisionReason}
                    onChange={(e) => setRevisionReason(e.target.value)}
                    placeholder="Explain what needs to be revised..."
                    rows={4}
                  />
                </div>
              </div>
            )}

            {quote.status === 'po_submitted' && (
              <div className="space-y-4">
                <Typography variant="bodySm" className="font-semibold">
                  PO Information
                </Typography>
                <div className="rounded-lg bg-fill-muted p-4">
                  <Typography variant="bodyXs" colorRole="muted">
                    PO Number
                  </Typography>
                  <Typography variant="bodySm" className="font-medium">
                    {quote.poNumber}
                  </Typography>
                </div>
                <div>
                  <Typography variant="bodySm" className="mb-2">
                    Confirmation Notes (optional)
                  </Typography>
                  <TextArea
                    id="poNotes"
                    value={confirmationNotes}
                    onChange={(e) => setConfirmationNotes(e.target.value)}
                    placeholder="Add any notes about this PO confirmation..."
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          {quote.status === 'buy_request_submitted' && (
            <Button
              variant="default"
              colorRole="brand"
              size="md"
              onClick={() => startReviewMutation.mutate()}
              isDisabled={startReviewMutation.isPending}
            >
              <ButtonContent iconLeft={IconPlayerPlay}>
                {startReviewMutation.isPending ? 'Starting...' : 'Start Review'}
              </ButtonContent>
            </Button>
          )}

          {quote.status === 'under_cc_review' && !showRevisionForm && (
            <>
              <Button
                variant="outline"
                colorRole="danger"
                size="md"
                onClick={() => setShowRevisionForm(true)}
              >
                <ButtonContent iconLeft={IconEdit}>Request Revision</ButtonContent>
              </Button>
              <Button
                variant="default"
                colorRole="success"
                size="md"
                onClick={() => confirmMutation.mutate()}
                isDisabled={confirmMutation.isPending}
              >
                <ButtonContent iconLeft={IconCheck}>
                  {confirmMutation.isPending ? 'Confirming...' : 'Confirm Quote'}
                </ButtonContent>
              </Button>
            </>
          )}

          {showRevisionForm && (
            <>
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setShowRevisionForm(false);
                  setRevisionReason('');
                }}
              >
                <ButtonContent>Cancel</ButtonContent>
              </Button>
              <Button
                variant="default"
                colorRole="danger"
                size="md"
                onClick={() => requestRevisionMutation.mutate()}
                isDisabled={
                  requestRevisionMutation.isPending || !revisionReason.trim()
                }
              >
                <ButtonContent iconLeft={IconEdit}>
                  {requestRevisionMutation.isPending
                    ? 'Submitting...'
                    : 'Submit Revision Request'}
                </ButtonContent>
              </Button>
            </>
          )}

          {quote.status === 'po_submitted' && (
            <Button
              variant="default"
              colorRole="success"
              size="md"
              onClick={() => confirmPOMutation.mutate()}
              isDisabled={confirmPOMutation.isPending}
            >
              <ButtonContent iconLeft={IconCheck}>
                {confirmPOMutation.isPending ? 'Confirming...' : 'Confirm PO'}
              </ButtonContent>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteApprovalDialog;
