'use client';

import { IconMail, IconSend, IconUser } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

interface SelectedPartner {
  partnerId: string;
  contactIds: string[];
}

export interface SendToPartnersDialogProps {
  rfqId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/**
 * Dialog for selecting partners and their contacts to send an RFQ to
 */
const SendToPartnersDialog = ({
  rfqId,
  open,
  onOpenChange,
  onSuccess,
}: SendToPartnersDialogProps) => {
  const api = useTRPC();
  const [selectedPartners, setSelectedPartners] = useState<SelectedPartner[]>([]);
  const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null);

  // Fetch available wine partners
  const { data: availablePartners } = useQuery({
    ...api.partners.getMany.queryOptions({
      type: 'wine_partner',
      status: 'active',
    }),
    enabled: open,
  });

  // Fetch contacts for expanded partner
  const { data: partnerContacts } = useQuery({
    ...api.partners.contacts.getMany.queryOptions({
      partnerId: expandedPartnerId || '',
    }),
    enabled: !!expandedPartnerId,
  });

  // Reset selection when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedPartners([]);
      setExpandedPartnerId(null);
    }
  }, [open]);

  // Send to partners mutation
  const { mutate: sendToPartners, isPending: isSending } = useMutation(
    api.source.admin.sendToPartners.mutationOptions({
      onSuccess: () => {
        onSuccess();
        onOpenChange(false);
      },
    }),
  );

  const handleTogglePartner = (partnerId: string) => {
    const existing = selectedPartners.find((p) => p.partnerId === partnerId);
    if (existing) {
      // Deselect partner
      setSelectedPartners((prev) => prev.filter((p) => p.partnerId !== partnerId));
      if (expandedPartnerId === partnerId) {
        setExpandedPartnerId(null);
      }
    } else {
      // Select partner and expand to show contacts
      setSelectedPartners((prev) => [...prev, { partnerId, contactIds: [] }]);
      setExpandedPartnerId(partnerId);
    }
  };

  const handleToggleContact = (partnerId: string, contactId: string) => {
    setSelectedPartners((prev) =>
      prev.map((p) => {
        if (p.partnerId !== partnerId) return p;
        const hasContact = p.contactIds.includes(contactId);
        return {
          ...p,
          contactIds: hasContact
            ? p.contactIds.filter((id) => id !== contactId)
            : [...p.contactIds, contactId],
        };
      }),
    );
  };

  const handleSelectAllContacts = (partnerId: string, contactIds: string[]) => {
    setSelectedPartners((prev) =>
      prev.map((p) => {
        if (p.partnerId !== partnerId) return p;
        return { ...p, contactIds };
      }),
    );
  };

  const handleSend = () => {
    const partnerIds = selectedPartners.map((p) => p.partnerId);
    const contactIds = selectedPartners.flatMap((p) => p.contactIds);

    if (partnerIds.length === 0) {
      alert('Please select at least one partner');
      return;
    }

    sendToPartners({
      rfqId,
      partnerIds,
      contactIds: contactIds.length > 0 ? contactIds : undefined,
    });
  };

  const isPartnerSelected = (partnerId: string) =>
    selectedPartners.some((p) => p.partnerId === partnerId);

  const getSelectedContactIds = (partnerId: string) =>
    selectedPartners.find((p) => p.partnerId === partnerId)?.contactIds || [];

  const totalContacts = selectedPartners.reduce((sum, p) => sum + p.contactIds.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send RFQ to Partners</DialogTitle>
          <DialogDescription>
            Select wine partners to send this RFQ to for quoting
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 my-4 max-h-[60vh] overflow-y-auto">
          {availablePartners?.map((partner) => {
            const isSelected = isPartnerSelected(partner.id);
            const isExpanded = expandedPartnerId === partner.id;
            const selectedContactIds = getSelectedContactIds(partner.id);

            return (
              <div key={partner.id} className="rounded-lg border border-border-muted overflow-hidden">
                {/* Partner row */}
                <label
                  className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-fill-brand/5 border-border-brand'
                      : 'hover:bg-fill-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleTogglePartner(partner.id)}
                    className="w-4 h-4 rounded border-border-primary"
                  />
                  <div className="flex-1">
                    <Typography variant="bodySm" className="font-medium">
                      {partner.businessName}
                    </Typography>
                    {partner.businessEmail && (
                      <Typography variant="bodyXs" colorRole="muted">
                        {partner.businessEmail}
                      </Typography>
                    )}
                  </div>
                  {isSelected && selectedContactIds.length > 0 && (
                    <span className="text-xs bg-fill-brand/10 text-text-brand px-2 py-0.5 rounded">
                      {selectedContactIds.length} contact{selectedContactIds.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </label>

                {/* Contacts section (expanded) */}
                {isSelected && isExpanded && partnerContacts && partnerContacts.length > 0 && (
                  <div className="border-t border-border-muted bg-fill-muted/50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Typography variant="bodyXs" className="font-medium flex items-center gap-1">
                        <IconUser className="h-3 w-3" />
                        Select contacts to notify
                      </Typography>
                      <button
                        type="button"
                        onClick={() =>
                          handleSelectAllContacts(
                            partner.id,
                            selectedContactIds.length === partnerContacts.length
                              ? []
                              : partnerContacts.map((c) => c.id),
                          )
                        }
                        className="text-xs text-text-brand hover:underline"
                      >
                        {selectedContactIds.length === partnerContacts.length
                          ? 'Deselect all'
                          : 'Select all'}
                      </button>
                    </div>
                    {partnerContacts.map((contact) => (
                      <label
                        key={contact.id}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                          selectedContactIds.includes(contact.id)
                            ? 'bg-fill-brand/10'
                            : 'hover:bg-fill-secondary'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedContactIds.includes(contact.id)}
                          onChange={() => handleToggleContact(partner.id, contact.id)}
                          className="w-3.5 h-3.5 rounded border-border-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{contact.name}</span>
                            {contact.isPrimary && (
                              <span className="text-xs bg-fill-brand/10 text-text-brand px-1 rounded">
                                Primary
                              </span>
                            )}
                            {contact.role && (
                              <span className="text-xs text-text-muted">({contact.role})</span>
                            )}
                          </div>
                          <span className="text-xs text-text-muted flex items-center gap-1">
                            <IconMail className="h-3 w-3" />
                            {contact.email}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {/* No contacts message */}
                {isSelected && isExpanded && partnerContacts && partnerContacts.length === 0 && (
                  <div className="border-t border-border-muted bg-fill-muted/50 p-3">
                    <Typography variant="bodyXs" colorRole="muted" className="text-center">
                      No contacts configured. Notification will go to company email.
                    </Typography>
                  </div>
                )}

                {/* Expand/collapse for selected partners */}
                {isSelected && !isExpanded && (
                  <button
                    type="button"
                    onClick={() => setExpandedPartnerId(partner.id)}
                    className="w-full text-xs text-text-brand hover:bg-fill-muted p-2 text-center border-t border-border-muted"
                  >
                    Select contacts to notify →
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center">
          <Typography variant="bodySm" colorRole="muted">
            {selectedPartners.length} partner{selectedPartners.length !== 1 ? 's' : ''}
            {totalContacts > 0 && `, ${totalContacts} contact${totalContacts !== 1 ? 's' : ''}`}
          </Typography>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <ButtonContent>Cancel</ButtonContent>
            </Button>
            <Button
              variant="default"
              colorRole="brand"
              onClick={handleSend}
              isDisabled={selectedPartners.length === 0 || isSending}
            >
              <ButtonContent iconLeft={IconSend}>
                {isSending ? 'Sending...' : 'Send RFQ'}
              </ButtonContent>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendToPartnersDialog;
