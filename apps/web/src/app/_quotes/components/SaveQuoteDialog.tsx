'use client';

import { DialogProps } from '@radix-ui/react-dialog';
import { IconCheck } from '@tabler/icons-react';
import Link from 'next/link';
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
import Divider from '@/app/_ui/components/Divider/Divider';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import { useTRPCClient } from '@/lib/trpc/browser';
import convertUsdToAed from '@/utils/convertUsdToAed';
import formatPrice from '@/utils/formatPrice';

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
  customerType?: 'b2b' | 'b2c';
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
  customerType = 'b2b',
  onSaveSuccess,
}: SaveQuoteDialogProps) => {
  const trpcClient = useTRPCClient();

  const [quoteName, setQuoteName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);

  // B2B margin configuration
  const [marginType, setMarginType] = useState<'percentage' | 'fixed'>('percentage');
  const [marginValue, setMarginValue] = useState(15);

  // Calculate customer quote price for B2B with margins
  const calculateCustomerPrice = () => {
    if (customerType !== 'b2b') return totalUsd;

    // Simple calculation: In-Bond + Margin
    // (In production, this should include import tax, transfer cost, VAT, etc.)
    const inBondPrice = totalUsd;
    const marginAmount =
      marginType === 'percentage'
        ? inBondPrice * (marginValue / 100)
        : marginValue;
    const priceAfterMargin = inBondPrice + marginAmount;
    const vat = priceAfterMargin * 0.05; // 5% VAT
    return priceAfterMargin + vat;
  };

  const customerQuotePrice = calculateCustomerPrice();

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
      // Enhance quoteData with margin configuration for B2B
      const enhancedQuoteData =
        customerType === 'b2b'
          ? {
              ...(quoteData as object),
              marginConfig: {
                type: marginType,
                value: marginValue,
              },
              customerQuotePrice: customerQuotePrice,
            }
          : quoteData;

      const savedQuote = await trpcClient.quotes.save.mutate({
        name: quoteName.trim(),
        lineItems,
        quoteData: enhancedQuoteData,
        clientName: clientName.trim() || undefined,
        clientEmail: clientEmail.trim() || undefined,
        clientCompany: clientCompany.trim() || undefined,
        notes: notes.trim() || undefined,
        currency,
        totalUsd,
        totalAed,
      });

      toast.success(`Quote "${quoteName}" saved successfully!`);

      // Set saved quote ID to show success state
      setSavedQuoteId(savedQuote.id);

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

  const handleClose = () => {
    // Reset all form state
    setQuoteName('');
    setClientName('');
    setClientEmail('');
    setClientCompany('');
    setNotes('');
    setSavedQuoteId(null);
    onOpenChange?.(false);
  };

  // Show success state if quote was saved
  const showSuccessState = savedQuoteId !== null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md">
        {showSuccessState ? (
          <>
            <DialogHeader>
              <DialogTitle>Quote Saved Successfully!</DialogTitle>
              <DialogDescription>
                Your quote has been saved and can be accessed anytime
              </DialogDescription>
            </DialogHeader>

            <DialogBody>
              <div className="flex flex-col items-center gap-6 py-4">
                <div className="bg-fill-success flex h-16 w-16 items-center justify-center rounded-full">
                  <Icon icon={IconCheck} size="xl" className="stroke-white" />
                </div>

                <div className="flex w-full flex-col gap-3">
                  <Link href="/platform/my-quotes" onClick={handleClose}>
                    <Button variant="default" size="md" className="w-full">
                      <ButtonContent>View All Quotes</ButtonContent>
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleClose}
                    className="w-full"
                  >
                    <ButtonContent>Create Another Quote</ButtonContent>
                  </Button>
                </div>
              </div>
            </DialogBody>
          </>
        ) : (
          <>
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

            {/* Pricing & Margins - B2B Only */}
            {customerType === 'b2b' && (
              <>
                <Divider />
                <div className="flex flex-col gap-3">
                  <Typography variant="bodySm" className="font-semibold">
                    Pricing & Margins
                  </Typography>

                  {/* In-Bond Price (Read-only) */}
                  <div className="rounded-lg border border-border-muted bg-fill-muted/30 p-3">
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      In-Bond UAE Price
                    </Typography>
                    <Typography variant="bodyMd" className="font-semibold">
                      {formatPrice(
                        currency === 'AED' && totalAed ? totalAed : totalUsd,
                        currency,
                      )}
                    </Typography>
                  </div>

                  {/* Margin Configuration */}
                  <div className="flex flex-col gap-2">
                    <Typography variant="bodyXs" colorRole="muted">
                      Distributor Margin
                    </Typography>

                    {/* Margin Type Toggle */}
                    <div className="flex gap-2">
                      <Button
                        variant={marginType === 'percentage' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setMarginType('percentage')}
                        isDisabled={isSaving}
                        className="flex-1"
                      >
                        <ButtonContent>Percentage (%)</ButtonContent>
                      </Button>
                      <Button
                        variant={marginType === 'fixed' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setMarginType('fixed')}
                        isDisabled={isSaving}
                        className="flex-1"
                      >
                        <ButtonContent>Fixed ({currency})</ButtonContent>
                      </Button>
                    </div>

                    {/* Margin Value Input */}
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={marginValue}
                        onChange={(e) => setMarginValue(Number(e.target.value))}
                        isDisabled={isSaving}
                        min={0}
                        step={marginType === 'percentage' ? 1 : 10}
                      />
                      <Typography variant="bodySm" colorRole="muted" className="min-w-[60px]">
                        {marginType === 'percentage' ? '%' : currency}
                      </Typography>
                    </div>
                  </div>

                  {/* Customer Quote Price (Calculated) */}
                  <div className="rounded-lg border border-border-brand bg-fill-brand/10 p-3">
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Customer Quote Price (Inc. VAT)
                    </Typography>
                    <Typography variant="bodyLg" className="font-bold text-text-brand">
                      {formatPrice(
                        currency === 'AED' && totalAed
                          ? convertUsdToAed(customerQuotePrice)
                          : customerQuotePrice,
                        currency,
                      )}
                    </Typography>
                  </div>
                </div>
                <Divider />
              </>
            )}

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
                rows={4}
                className="w-full min-h-[100px] rounded-md border border-border-muted bg-background-primary px-3 py-2 text-sm transition-colors placeholder:text-text-muted focus:border-border-brand focus:outline-none focus:ring-2 focus:ring-fill-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse gap-3 min-[400px]:flex-row">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={handleClose}
                isDisabled={isSaving}
                className="w-full min-[400px]:flex-1"
              >
                <ButtonContent>Cancel</ButtonContent>
              </Button>
              <Button
                type="button"
                variant="default"
                size="md"
                onClick={handleSave}
                isDisabled={isSaving}
                className="w-full min-[400px]:flex-1"
              >
                <ButtonContent>{isSaving ? 'Saving...' : 'Save Quote'}</ButtonContent>
              </Button>
            </div>
          </div>
            </DialogBody>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SaveQuoteDialog;
