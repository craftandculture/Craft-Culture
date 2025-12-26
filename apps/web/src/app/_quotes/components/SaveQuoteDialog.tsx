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

export interface MarginConfig {
  marginType: 'percentage' | 'fixed';
  marginValue: number;
  transferCost: number;
  importTax: number;
  customerQuotePrice: number;
  displayCurrency: 'USD' | 'AED';
}

export interface OutOfCatalogueItem {
  id: string;
  productName: string;
  vintage?: string;
  quantity?: number;
  priceExpectation?: string;
  notes?: string;
}

export interface SaveQuoteDialogProps extends DialogProps {
  lineItems: Array<{
    productId: string;
    offerId: string;
    quantity: number;
    vintage?: string;
    alternativeVintages?: string[];
  }>;
  quoteData: unknown;
  currency: 'USD' | 'AED';
  totalUsd: number;
  totalAed?: number;
  customerType?: 'b2b' | 'b2c';
  marginConfig?: MarginConfig;
  outOfCatalogueItems?: OutOfCatalogueItem[];
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
  marginConfig,
  outOfCatalogueItems,
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

    if (!quoteData) {
      toast.error('Quote data is missing. Please generate a quote first.');
      return;
    }

    setIsSaving(true);

    try {
      // Enhance quoteData with margin configuration for B2B if provided
      // and out-of-catalogue items for B2C if provided
      let enhancedQuoteData = quoteData;

      if (customerType === 'b2b' && marginConfig) {
        enhancedQuoteData = {
          ...(enhancedQuoteData as object),
          marginConfig: {
            type: marginConfig.marginType,
            value: marginConfig.marginValue,
            transferCost: marginConfig.transferCost,
            importTax: marginConfig.importTax,
          },
          customerQuotePrice: marginConfig.customerQuotePrice,
        };
      }

      // Add out-of-catalogue items if any (B2C only)
      if (outOfCatalogueItems && outOfCatalogueItems.length > 0) {
        // Filter out items without a product name
        const validItems = outOfCatalogueItems.filter(
          (item) => item.productName.trim() !== '',
        );
        if (validItems.length > 0) {
          enhancedQuoteData = {
            ...(enhancedQuoteData as object),
            outOfCatalogueRequests: validItems,
          };
        }
      }

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

            {/* Show pricing summary if margin config provided */}
            {marginConfig && (
              <>
                <Divider />
                <div className="rounded-lg border border-border-brand bg-fill-brand/10 p-3">
                  <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                    Customer Quote Price (from Margin Calculator)
                  </Typography>
                  <Typography variant="bodyLg" className="font-bold text-text-brand">
                    {formatPrice(
                      marginConfig.displayCurrency === 'AED'
                        ? convertUsdToAed(marginConfig.customerQuotePrice)
                        : marginConfig.customerQuotePrice,
                      marginConfig.displayCurrency,
                    )}
                  </Typography>
                </div>
                <Divider />
              </>
            )}

            {/* Show out-of-catalogue requests summary if any */}
            {outOfCatalogueItems && outOfCatalogueItems.filter((i) => i.productName.trim()).length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                  Out-of-Catalogue Requests
                </Typography>
                <Typography variant="bodySm" className="font-medium text-amber-800">
                  {outOfCatalogueItems.filter((i) => i.productName.trim()).length} item(s) will be reviewed by our team
                </Typography>
              </div>
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
                rows={3}
                className="min-h-[80px] w-full resize-none rounded-lg border border-b-2 border-border-primary bg-fill-primary px-2.5 py-2 text-sm font-medium tracking-tight text-text-primary transition-all duration-200 placeholder:text-text-muted/60 hover:border-border-primary-hover focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-border-primary disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
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
