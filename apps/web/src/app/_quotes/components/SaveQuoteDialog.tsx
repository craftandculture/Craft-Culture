'use client';

import { DialogProps } from '@radix-ui/react-dialog';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogBody from '@/app/_ui/components/Dialog/DialogBody';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import { useTRPCClient } from '@/lib/trpc/browser';

export interface SaveQuoteDialogProps extends DialogProps {
  lineItems: Array<{
    productId: string;
    offerId: string;
    quantity: number;
    vintage?: string;
  }>;
  quoteData: unknown;
  currency: 'USD' | 'AED';
  totalUsd: number;
  totalAed?: number;
  onSaveSuccess?: (quoteId: string) => void;
}

const SaveQuoteDialog = ({
  open,
  onOpenChange,
  lineItems,
  quoteData,
  currency,
  totalUsd,
  totalAed,
  onSaveSuccess,
}: SaveQuoteDialogProps) => {
  const trpcClient = useTRPCClient();

  const [quoteName, setQuoteName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    // Validation
    if (!quoteName.trim()) {
      toast.error('Please enter a quote name');
      return;
    }

    if (lineItems.length === 0) {
      toast.error('Please add at least one product to the quote');
      return;
    }

    setIsSaving(true);

    try {
      const savedQuote = await trpcClient.quotes.save.mutate({
        name: quoteName.trim(),
        lineItems,
        quoteData,
        clientName: clientName.trim() || undefined,
        clientEmail: clientEmail.trim() || undefined,
        clientCompany: clientCompany.trim() || undefined,
        notes: notes.trim() || undefined,
        currency,
        totalUsd,
        totalAed,
      });

      toast.success(`Quote "${quoteName}" saved successfully!`);

      // Reset form
      setQuoteName('');
      setClientName('');
      setClientEmail('');
      setClientCompany('');
      setNotes('');

      // Close dialog
      onOpenChange?.(false);

      // Callback
      if (onSaveSuccess && savedQuote) {
        onSaveSuccess(savedQuote.id);
      }
    } catch (error) {
      console.error('Error saving quote:', error);
      toast.error('Failed to save quote. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save Quote</DialogTitle>
          <DialogDescription>
            Save this quote for future reference or to share with clients
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="flex flex-col gap-4">
            {/* Quote Name */}
            <div className="flex flex-col gap-1.5">
              <Typography variant="bodySm" className="font-medium">
                Quote Name <span className="text-red-500">*</span>
              </Typography>
              <Input
                type="text"
                placeholder="e.g., Hotel ABC - January 2025"
                value={quoteName}
                onChange={(e) => setQuoteName(e.target.value)}
                isDisabled={isSaving}
              />
            </div>

            {/* Client Name */}
            <div className="flex flex-col gap-1.5">
              <Typography variant="bodySm" className="font-medium">
                Client Name
              </Typography>
              <Input
                type="text"
                placeholder="John Doe"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                isDisabled={isSaving}
              />
            </div>

            {/* Client Email */}
            <div className="flex flex-col gap-1.5">
              <Typography variant="bodySm" className="font-medium">
                Client Email
              </Typography>
              <Input
                type="email"
                placeholder="john@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                isDisabled={isSaving}
              />
            </div>

            {/* Client Company */}
            <div className="flex flex-col gap-1.5">
              <Typography variant="bodySm" className="font-medium">
                Client Company
              </Typography>
              <Input
                type="text"
                placeholder="ABC Hotel Group"
                value={clientCompany}
                onChange={(e) => setClientCompany(e.target.value)}
                isDisabled={isSaving}
              />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <Typography variant="bodySm" className="font-medium">
                Notes
              </Typography>
              <textarea
                placeholder="Additional notes or special instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSaving}
                rows={3}
                className="w-full rounded-md border border-border-muted bg-background-primary px-3 py-2 text-sm transition-colors placeholder:text-text-muted focus:border-border-brand focus:outline-none focus:ring-2 focus:ring-fill-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => onOpenChange?.(false)}
                isDisabled={isSaving}
                className="grow"
              >
                <ButtonContent>Cancel</ButtonContent>
              </Button>
              <Button
                type="button"
                variant="default"
                size="md"
                onClick={handleSave}
                isDisabled={isSaving}
                className="grow"
              >
                <ButtonContent>{isSaving ? 'Saving...' : 'Save Quote'}</ButtonContent>
              </Button>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export default SaveQuoteDialog;
