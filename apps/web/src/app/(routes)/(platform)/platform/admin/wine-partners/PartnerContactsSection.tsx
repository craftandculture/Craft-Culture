'use client';

import {
  IconMail,
  IconPhone,
  IconPlus,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconUser,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import AlertDialog from '@/app/_ui/components/AlertDialog/AlertDialog';
import AlertDialogAction from '@/app/_ui/components/AlertDialog/AlertDialogAction';
import AlertDialogCancel from '@/app/_ui/components/AlertDialog/AlertDialogCancel';
import AlertDialogContent from '@/app/_ui/components/AlertDialog/AlertDialogContent';
import AlertDialogDescription from '@/app/_ui/components/AlertDialog/AlertDialogDescription';
import AlertDialogFooter from '@/app/_ui/components/AlertDialog/AlertDialogFooter';
import AlertDialogHeader from '@/app/_ui/components/AlertDialog/AlertDialogHeader';
import AlertDialogTitle from '@/app/_ui/components/AlertDialog/AlertDialogTitle';
import AlertDialogTrigger from '@/app/_ui/components/AlertDialog/AlertDialogTrigger';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

export interface PartnerContactsSectionProps {
  partnerId: string;
}

/**
 * Section for managing partner contacts (for RFQ notifications)
 */
const PartnerContactsSection = ({ partnerId }: PartnerContactsSectionProps) => {
  const api = useTRPC();
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    role: '',
    phone: '',
    isPrimary: false,
  });

  // Fetch contacts for this partner
  const { data: contacts, refetch } = useQuery({
    ...api.partners.contacts.getMany.queryOptions({ partnerId }),
  });

  // Create contact mutation
  const { mutate: createContact, isPending: isCreating } = useMutation(
    api.partners.contacts.create.mutationOptions({
      onSuccess: () => {
        void refetch();
        setIsAddingContact(false);
        setNewContact({ name: '', email: '', role: '', phone: '', isPrimary: false });
      },
    }),
  );

  // Update contact mutation (for setting primary)
  const { mutate: updateContact } = useMutation(
    api.partners.contacts.update.mutationOptions({
      onSuccess: () => {
        void refetch();
      },
    }),
  );

  // Delete contact mutation
  const { mutate: deleteContact, isPending: isDeleting } = useMutation(
    api.partners.contacts.delete.mutationOptions({
      onSuccess: () => {
        void refetch();
      },
    }),
  );

  const handleAddContact = () => {
    createContact({
      partnerId,
      name: newContact.name,
      email: newContact.email,
      role: newContact.role || undefined,
      phone: newContact.phone || undefined,
      isPrimary: newContact.isPrimary,
    });
  };

  const handleSetPrimary = (contactId: string) => {
    updateContact({ id: contactId, isPrimary: true });
  };

  return (
    <div className="space-y-3 border-t border-border-muted pt-4">
      <div className="flex items-center justify-between">
        <Typography variant="bodySm" className="font-semibold flex items-center gap-2">
          <IconUser className="h-4 w-4" />
          Contacts for RFQ Notifications
        </Typography>
        {!isAddingContact && (
          <Button size="sm" variant="ghost" onClick={() => setIsAddingContact(true)}>
            <ButtonContent iconLeft={IconPlus}>Add</ButtonContent>
          </Button>
        )}
      </div>

      {/* Add Contact Form */}
      {isAddingContact && (
        <div className="bg-fill-muted rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Name *"
              value={newContact.name}
              onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              className="rounded-md border border-border-primary bg-background-primary px-2 py-1.5 text-sm"
            />
            <input
              type="email"
              placeholder="Email *"
              value={newContact.email}
              onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
              className="rounded-md border border-border-primary bg-background-primary px-2 py-1.5 text-sm"
            />
            <input
              type="text"
              placeholder="Role (e.g., Buyer)"
              value={newContact.role}
              onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
              className="rounded-md border border-border-primary bg-background-primary px-2 py-1.5 text-sm"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={newContact.phone}
              onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
              className="rounded-md border border-border-primary bg-background-primary px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-text-muted">
              <input
                type="checkbox"
                checked={newContact.isPrimary}
                onChange={(e) => setNewContact({ ...newContact, isPrimary: e.target.checked })}
                className="rounded"
              />
              Primary contact
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsAddingContact(false);
                setNewContact({ name: '', email: '', role: '', phone: '', isPrimary: false });
              }}
            >
              <ButtonContent>Cancel</ButtonContent>
            </Button>
            <Button
              size="sm"
              variant="default"
              colorRole="brand"
              onClick={handleAddContact}
              isDisabled={isCreating || !newContact.name || !newContact.email}
            >
              <ButtonContent>{isCreating ? 'Adding...' : 'Add Contact'}</ButtonContent>
            </Button>
          </div>
        </div>
      )}

      {/* Contacts List */}
      {contacts && contacts.length > 0 ? (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between bg-fill-secondary rounded-lg px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Typography variant="bodySm" className="font-medium truncate">
                    {contact.name}
                  </Typography>
                  {contact.isPrimary && (
                    <span className="bg-fill-brand/10 text-text-brand text-xs px-1.5 py-0.5 rounded">
                      Primary
                    </span>
                  )}
                  {contact.role && (
                    <span className="text-text-muted text-xs">({contact.role})</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-text-muted flex items-center gap-1">
                    <IconMail className="h-3 w-3" />
                    {contact.email}
                  </span>
                  {contact.phone && (
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <IconPhone className="h-3 w-3" />
                      {contact.phone}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                {!contact.isPrimary && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSetPrimary(contact.id)}
                    title="Set as primary contact"
                  >
                    <IconStar className="h-4 w-4" />
                  </Button>
                )}
                {contact.isPrimary && (
                  <IconStarFilled className="h-4 w-4 text-text-brand" />
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      colorRole="danger"
                      isDisabled={isDeleting}
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Contact</AlertDialogTitle>
                      <AlertDialogDescription>
                        Remove <strong>{contact.name}</strong> from this partner&apos;s contacts?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteContact({ id: contact.id })}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Typography variant="bodyXs" colorRole="muted" className="text-center py-2">
          No contacts added yet. Add contacts to receive RFQ notifications.
        </Typography>
      )}
    </div>
  );
};

export default PartnerContactsSection;
