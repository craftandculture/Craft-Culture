'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Input from '@/app/_ui/components/Input/Input';
import TextArea from '@/app/_ui/components/TextArea/TextArea';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { PrivateClientContact } from '@/database/schema';
import { useTRPCClient } from '@/lib/trpc/browser';

interface ClientContactFormProps {
  contact?: PrivateClientContact;
  mode: 'create' | 'edit';
}

/**
 * Form for creating/editing client contacts
 */
const ClientContactForm = ({ contact, mode }: ClientContactFormProps) => {
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: contact?.name ?? '',
    email: contact?.email ?? '',
    phone: contact?.phone ?? '',
    addressLine1: contact?.addressLine1 ?? '',
    addressLine2: contact?.addressLine2 ?? '',
    city: contact?.city ?? '',
    stateProvince: contact?.stateProvince ?? '',
    postalCode: contact?.postalCode ?? '',
    country: contact?.country ?? '',
    winePreferences: contact?.winePreferences ?? '',
    deliveryInstructions: contact?.deliveryInstructions ?? '',
    paymentNotes: contact?.paymentNotes ?? '',
    notes: contact?.notes ?? '',
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => trpcClient.privateClientContacts.create.mutate(data),
    onSuccess: (newContact) => {
      void queryClient.invalidateQueries({ queryKey: ['privateClientContacts.getMany'] });
      toast.success('Client created');
      if (newContact) {
        router.push(`/platform/clients/${newContact.id}`);
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create client');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      trpcClient.privateClientContacts.update.mutate({ id: contact!.id, ...data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['privateClientContacts'] });
      toast.success('Client updated');
      router.push(`/platform/clients/${contact!.id}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update client');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'create') {
      createMutation.mutate(formData);
    } else {
      updateMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Info */}
      <div className="space-y-4">
        <Typography variant="headingXs">Basic Information</Typography>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Typography variant="labelSm" asChild>
              <label htmlFor="name">Name *</label>
            </Typography>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Smith"
              required
            />
          </div>
          <div className="space-y-2">
            <Typography variant="labelSm" asChild>
              <label htmlFor="email">Email</label>
            </Typography>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="john@example.com"
            />
          </div>
          <div className="space-y-2">
            <Typography variant="labelSm" asChild>
              <label htmlFor="phone">Phone</label>
            </Typography>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+971 50 123 4567"
            />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <Typography variant="headingXs">Address</Typography>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Typography variant="labelSm" asChild>
              <label htmlFor="addressLine1">Address Line 1</label>
            </Typography>
            <Input
              id="addressLine1"
              value={formData.addressLine1}
              onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
              placeholder="123 Marina Walk"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Typography variant="labelSm" asChild>
              <label htmlFor="addressLine2">Address Line 2</label>
            </Typography>
            <Input
              id="addressLine2"
              value={formData.addressLine2}
              onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
              placeholder="Apartment 4B"
            />
          </div>
          <div className="space-y-2">
            <Typography variant="labelSm" asChild>
              <label htmlFor="city">City</label>
            </Typography>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Dubai"
            />
          </div>
          <div className="space-y-2">
            <Typography variant="labelSm" asChild>
              <label htmlFor="stateProvince">Community</label>
            </Typography>
            <Input
              id="stateProvince"
              value={formData.stateProvince}
              onChange={(e) => setFormData({ ...formData, stateProvince: e.target.value })}
              placeholder="Dubai Marina"
            />
          </div>
          <div className="space-y-2">
            <Typography variant="labelSm" asChild>
              <label htmlFor="country">Country</label>
            </Typography>
            <Input
              id="country"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              placeholder="UAE"
            />
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="space-y-4">
        <Typography variant="headingXs">Preferences</Typography>
        <div className="space-y-4">
          <div className="space-y-2">
            <Typography variant="labelSm" asChild>
              <label htmlFor="winePreferences">Wine Preferences</label>
            </Typography>
            <TextArea
              id="winePreferences"
              value={formData.winePreferences}
              onChange={(e) => setFormData({ ...formData, winePreferences: e.target.value })}
              placeholder="Prefers bold reds, Bordeaux style wines, allocated Burgundy..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Typography variant="labelSm" asChild>
              <label htmlFor="deliveryInstructions">Delivery Instructions</label>
            </Typography>
            <TextArea
              id="deliveryInstructions"
              value={formData.deliveryInstructions}
              onChange={(e) => setFormData({ ...formData, deliveryInstructions: e.target.value })}
              placeholder="Call before delivery, leave with concierge if not available..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Typography variant="labelSm" asChild>
              <label htmlFor="paymentNotes">Payment Notes</label>
            </Typography>
            <TextArea
              id="paymentNotes"
              value={formData.paymentNotes}
              onChange={(e) => setFormData({ ...formData, paymentNotes: e.target.value })}
              placeholder="Net 30 terms, prefers bank transfer..."
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-4">
        <Typography variant="headingXs">Notes</Typography>
        <div className="space-y-2">
          <Typography variant="labelSm" asChild>
            <label htmlFor="notes">Internal Notes</label>
          </Typography>
          <TextArea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Any additional notes about this client..."
            rows={4}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : mode === 'create' ? 'Create Client' : 'Save Changes'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

export default ClientContactForm;
