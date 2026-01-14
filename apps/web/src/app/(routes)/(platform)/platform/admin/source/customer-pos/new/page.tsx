'use client';

import { IconArrowLeft, IconLink } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * Create new Customer PO page
 */
const NewCustomerPoPage = () => {
  const api = useTRPC();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rfqIdParam = searchParams.get('rfqId');

  // Form state
  const [poNumber, setPoNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedRfqId, setSelectedRfqId] = useState<string | null>(rfqIdParam);

  // Get RFQs for linking (show RFQs at quote_generated or later stages)
  // In PO-first flow, we link to RFQs that have received quotes
  const { data: rfqsData } = useQuery({
    ...api.source.admin.getMany.queryOptions({
      limit: 50,
    }),
  });

  // Filter to only show RFQs that can have customer POs linked
  // (quote_generated, client_review, awaiting_confirmation, confirmed, finalized)
  const linkableStatuses = [
    'quote_generated',
    'client_review',
    'awaiting_confirmation',
    'confirmed',
    'finalized',
  ];

  const rfqs = (rfqsData?.data ?? []).filter((rfq) =>
    linkableStatuses.includes(rfq.status)
  );

  // Get selected RFQ details
  const { data: selectedRfq } = useQuery({
    ...api.source.admin.getOne.queryOptions({ rfqId: selectedRfqId ?? '' }),
    enabled: !!selectedRfqId,
  });

  // Pre-fill from RFQ if linked
  useEffect(() => {
    if (selectedRfq && !customerName && !customerCompany) {
      if (selectedRfq.distributorName) {
        setCustomerName(selectedRfq.distributorName);
      }
      if (selectedRfq.distributorCompany) {
        setCustomerCompany(selectedRfq.distributorCompany);
      }
      if (selectedRfq.distributorEmail) {
        setCustomerEmail(selectedRfq.distributorEmail);
      }
    }
  }, [selectedRfq, customerName, customerCompany]);

  // Create Customer PO mutation
  const { mutate: createCustomerPo, isPending: isCreating } = useMutation(
    api.source.admin.customerPo.create.mutationOptions({
      onSuccess: (customerPo) => {
        toast.success('Customer PO created successfully');
        router.push(`/platform/admin/source/customer-pos/${customerPo.id}`);
      },
      onError: (error) => {
        toast.error(`Failed to create Customer PO: ${error.message}`);
      },
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!poNumber.trim()) {
      toast.warning('Please enter a Customer PO number');
      return;
    }

    if (!customerName.trim()) {
      toast.warning('Please enter a customer name');
      return;
    }

    createCustomerPo({
      poNumber: poNumber.trim(),
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerCompany: customerCompany.trim() || undefined,
      rfqId: selectedRfqId || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/platform/admin/source/customer-pos">
            <Button variant="ghost" size="sm">
              <ButtonContent iconLeft={IconArrowLeft}>Back</ButtonContent>
            </Button>
          </Link>
          <div>
            <Typography variant="headingLg">New Customer PO</Typography>
            <Typography variant="bodySm" colorRole="muted">
              Create a new customer purchase order
            </Typography>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardContent className="p-6 space-y-6">
              {/* Customer PO Number */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Customer PO Number *
                </label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="e.g., PO-2026-001"
                  className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                  The PO number from your customer&apos;s purchase order
                </Typography>
              </div>

              {/* Link to RFQ */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  <span className="flex items-center gap-1.5">
                    <IconLink className="h-4 w-4" />
                    Link to RFQ (Optional)
                  </span>
                </label>
                <select
                  value={selectedRfqId || ''}
                  onChange={(e) => setSelectedRfqId(e.target.value || null)}
                  className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No RFQ linked</option>
                  {rfqs.map((rfq) => (
                    <option key={rfq.id} value={rfq.id}>
                      {rfq.rfqNumber} - {rfq.name}
                    </option>
                  ))}
                </select>
                <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                  Link to an existing RFQ to auto-match items and quotes
                </Typography>
              </div>

              {selectedRfq && (
                <div className="p-3 bg-fill-brand/5 border border-border-brand rounded-lg">
                  <Typography variant="bodySm" className="font-medium text-text-brand">
                    Linked RFQ: {selectedRfq.rfqNumber}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    {selectedRfq.name} • {selectedRfq.itemCount} items
                  </Typography>
                </div>
              )}

              <div className="border-t border-border-muted pt-6">
                <Typography variant="headingSm" className="mb-4">
                  Customer Information
                </Typography>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Contact Name *
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g., John Smith"
                      className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={customerCompany}
                      onChange={(e) => setCustomerCompany(e.target.value)}
                      placeholder="e.g., Wine Imports Ltd"
                      className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="john@wineimports.com"
                      className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any internal notes about this order..."
                  rows={3}
                  className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end pt-4 border-t border-border-muted">
                <Button
                  type="submit"
                  variant="default"
                  colorRole="brand"
                  isDisabled={isCreating || !poNumber.trim() || !customerName.trim()}
                >
                  <ButtonContent>
                    {isCreating ? 'Creating...' : 'Create Customer PO'}
                  </ButtonContent>
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
};

export default NewCustomerPoPage;
