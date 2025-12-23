'use client';

import {
  IconBuilding,
  IconCopy,
  IconCreditCard,
  IconExternalLink,
  IconKey,
  IconLock,
  IconMapPin,
  IconPhone,
  IconPhoto,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
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
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import DialogTrigger from '@/app/_ui/components/Dialog/DialogTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

type PartnerType = 'retailer' | 'sommelier' | 'distributor';
type PartnerStatus = 'active' | 'inactive' | 'suspended';

interface PaymentDetails {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  sortCode?: string;
  iban?: string;
  swiftBic?: string;
  reference?: string;
  paymentUrl?: string;
}

/**
 * Admin page for managing licensed partners
 *
 * Partners are external business entities (retailers, distributors) that
 * fulfill B2C orders. They're licensed mainland entities that receive
 * payment from customers and purchase inventory from C&C.
 */
const PartnersPage = () => {
  const api = useTRPC();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PartnerStatus | 'all'>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state for creating partner
  const [newPartner, setNewPartner] = useState({
    type: 'retailer' as PartnerType,
    businessName: '',
    businessAddress: '',
    businessPhone: '',
    businessEmail: '',
    taxId: '',
    logoUrl: '',
    enableBankTransfer: false,
    enablePaymentLink: false,
    paymentDetails: {} as PaymentDetails,
    commissionRate: 0,
  });

  // Form state for creating API key
  const [newApiKey, setNewApiKey] = useState({
    name: '',
    permissions: ['read:inventory'] as string[],
  });

  // Edit partner dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<{
    id: string;
    businessName: string;
    businessAddress: string;
    businessPhone: string;
    businessEmail: string;
    taxId: string;
    logoUrl: string;
    enableBankTransfer: boolean;
    enablePaymentLink: boolean;
    paymentDetails: PaymentDetails | null;
    commissionRate: number;
  } | null>(null);

  // Fetch partners
  const { data, isLoading, refetch } = useQuery({
    ...api.partners.getMany.queryOptions({
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: searchQuery || undefined,
    }),
  });

  // Create partner mutation
  const { mutate: createPartner, isPending: isCreating } = useMutation(
    api.partners.create.mutationOptions({
      onSuccess: () => {
        void refetch();
        setIsCreateDialogOpen(false);
        setNewPartner({
          type: 'retailer',
          businessName: '',
          businessAddress: '',
          businessPhone: '',
          businessEmail: '',
          taxId: '',
          logoUrl: '',
          enableBankTransfer: false,
          enablePaymentLink: false,
          paymentDetails: {},
          commissionRate: 0,
        });
      },
    }),
  );

  // Update partner mutation
  const { mutate: updatePartner, isPending: isUpdating } = useMutation(
    api.partners.update.mutationOptions({
      onSuccess: () => {
        void refetch();
        setIsEditDialogOpen(false);
        setEditingPartner(null);
      },
    }),
  );

  // Create API key mutation
  const { mutate: createApiKey, isPending: isCreatingKey } = useMutation(
    api.partners.apiKeys.create.mutationOptions({
      onSuccess: (data) => {
        setGeneratedApiKey(data.key);
        void refetch();
      },
    }),
  );

  // Revoke API key mutation
  const { mutate: revokeApiKey, isPending: isRevoking } = useMutation(
    api.partners.apiKeys.revoke.mutationOptions({
      onSuccess: () => {
        void refetch();
      },
    }),
  );

  // Delete API key mutation
  const { mutate: deleteApiKey, isPending: isDeleting } = useMutation(
    api.partners.apiKeys.delete.mutationOptions({
      onSuccess: () => {
        void refetch();
      },
    }),
  );

  const partners = data ?? [];

  const getStatusBadge = (status: PartnerStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="bg-fill-brand/10 text-text-brand border border-border-brand inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
            Active
          </span>
        );
      case 'inactive':
        return (
          <span className="bg-fill-muted text-text-muted border border-border-muted inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
            Inactive
          </span>
        );
      case 'suspended':
        return (
          <span className="bg-fill-warning/10 text-text-warning border border-border-warning inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
            Suspended
          </span>
        );
    }
  };

  const getTypeBadge = (type: PartnerType) => {
    const labels = {
      retailer: 'Retailer',
      sommelier: 'Sommelier',
      distributor: 'Distributor',
    };
    return (
      <span className="bg-fill-muted text-text-secondary inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
        {labels[type]}
      </span>
    );
  };

  const handleCopyApiKey = () => {
    if (generatedApiKey) {
      void navigator.clipboard.writeText(generatedApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateApiKey = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    setGeneratedApiKey(null);
    setNewApiKey({ name: '', permissions: ['read:inventory'] });
    setIsApiKeyDialogOpen(true);
  };

  const handleEditPartner = (partner: (typeof partners)[0]) => {
    // Infer enabled payment methods from paymentDetails
    const hasBankDetails = !!(
      partner.paymentDetails?.bankName ||
      partner.paymentDetails?.iban ||
      partner.paymentDetails?.accountNumber
    );
    const hasPaymentLink = !!partner.paymentDetails?.paymentUrl;

    setEditingPartner({
      id: partner.id,
      businessName: partner.businessName,
      businessAddress: partner.businessAddress || '',
      businessPhone: partner.businessPhone || '',
      businessEmail: partner.businessEmail || '',
      taxId: partner.taxId || '',
      logoUrl: partner.logoUrl || '',
      enableBankTransfer: hasBankDetails,
      enablePaymentLink: hasPaymentLink,
      paymentDetails: partner.paymentDetails,
      commissionRate: partner.commissionRate,
    });
    setIsEditDialogOpen(true);
  };

  const handleSavePartner = () => {
    if (!editingPartner) return;

    // Build payment details based on enabled methods
    const paymentDetails: PaymentDetails = {};
    if (editingPartner.enableBankTransfer && editingPartner.paymentDetails) {
      paymentDetails.bankName = editingPartner.paymentDetails.bankName;
      paymentDetails.accountName = editingPartner.paymentDetails.accountName;
      paymentDetails.accountNumber = editingPartner.paymentDetails.accountNumber;
      paymentDetails.iban = editingPartner.paymentDetails.iban;
      paymentDetails.swiftBic = editingPartner.paymentDetails.swiftBic;
    }
    if (editingPartner.enablePaymentLink && editingPartner.paymentDetails) {
      paymentDetails.paymentUrl = editingPartner.paymentDetails.paymentUrl;
    }

    updatePartner({
      partnerId: editingPartner.id,
      businessName: editingPartner.businessName,
      businessAddress: editingPartner.businessAddress || undefined,
      businessPhone: editingPartner.businessPhone || undefined,
      businessEmail: editingPartner.businessEmail || undefined,
      taxId: editingPartner.taxId || undefined,
      logoUrl: editingPartner.logoUrl || undefined,
      paymentDetails: Object.keys(paymentDetails).length > 0 ? paymentDetails : undefined,
      commissionRate: editingPartner.commissionRate,
    });
  };

  const handleCreatePartner = () => {
    // Build payment details based on enabled methods
    const paymentDetails: PaymentDetails = {};
    if (newPartner.enableBankTransfer) {
      paymentDetails.bankName = newPartner.paymentDetails.bankName;
      paymentDetails.accountName = newPartner.paymentDetails.accountName;
      paymentDetails.accountNumber = newPartner.paymentDetails.accountNumber;
      paymentDetails.iban = newPartner.paymentDetails.iban;
      paymentDetails.swiftBic = newPartner.paymentDetails.swiftBic;
    }
    if (newPartner.enablePaymentLink) {
      paymentDetails.paymentUrl = newPartner.paymentDetails.paymentUrl;
    }

    createPartner({
      type: newPartner.type,
      businessName: newPartner.businessName,
      businessAddress: newPartner.businessAddress,
      businessPhone: newPartner.businessPhone || undefined,
      businessEmail: newPartner.businessEmail || undefined,
      taxId: newPartner.taxId,
      logoUrl: newPartner.logoUrl || undefined,
      paymentDetails: Object.keys(paymentDetails).length > 0 ? paymentDetails : undefined,
      commissionRate: newPartner.commissionRate,
    });
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <Typography variant="headingLg" className="mb-2">
              Licensed Partners
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              Manage licensed entities that fulfill B2C orders
            </Typography>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/docs/api" target="_blank">
              <Button variant="outline">
                <ButtonContent iconRight={IconExternalLink}>API Docs</ButtonContent>
              </Button>
            </Link>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" colorRole="brand">
                  <ButtonContent iconLeft={IconPlus}>Add Partner</ButtonContent>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Licensed Partner</DialogTitle>
                  <DialogDescription>
                    Add a licensed entity that will fulfill B2C orders
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCreatePartner();
                  }}
                  className="space-y-6 mt-4"
                >
                  {/* Business Details Section */}
                  <div className="space-y-4">
                    <Typography variant="bodySm" className="font-semibold flex items-center gap-2">
                      <IconBuilding className="h-4 w-4" />
                      Business Details
                    </Typography>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-text-primary mb-1">
                          Business Name *
                        </label>
                        <input
                          type="text"
                          value={newPartner.businessName}
                          onChange={(e) =>
                            setNewPartner({ ...newPartner, businessName: e.target.value })
                          }
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1">
                          Partner Type
                        </label>
                        <select
                          value={newPartner.type}
                          onChange={(e) =>
                            setNewPartner({
                              ...newPartner,
                              type: e.target.value as PartnerType,
                            })
                          }
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        >
                          <option value="retailer">Retailer</option>
                          <option value="distributor">Distributor</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1">
                          TRN / Tax ID *
                        </label>
                        <input
                          type="text"
                          value={newPartner.taxId}
                          onChange={(e) =>
                            setNewPartner({ ...newPartner, taxId: e.target.value })
                          }
                          placeholder="e.g., 100123456789003"
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                          required
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-text-primary mb-1">
                          Business Address *
                        </label>
                        <textarea
                          value={newPartner.businessAddress}
                          onChange={(e) =>
                            setNewPartner({ ...newPartner, businessAddress: e.target.value })
                          }
                          rows={2}
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={newPartner.businessEmail}
                          onChange={(e) =>
                            setNewPartner({ ...newPartner, businessEmail: e.target.value })
                          }
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={newPartner.businessPhone}
                          onChange={(e) =>
                            setNewPartner({ ...newPartner, businessPhone: e.target.value })
                          }
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Branding Section */}
                  <div className="space-y-4 border-t border-border-muted pt-4">
                    <Typography variant="bodySm" className="font-semibold flex items-center gap-2">
                      <IconPhoto className="h-4 w-4" />
                      Branding
                    </Typography>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Logo URL
                      </label>
                      <input
                        type="url"
                        value={newPartner.logoUrl}
                        onChange={(e) =>
                          setNewPartner({ ...newPartner, logoUrl: e.target.value })
                        }
                        placeholder="https://example.com/logo.png"
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                      />
                      {newPartner.logoUrl && (
                        <div className="mt-2 p-2 bg-fill-muted rounded-lg inline-block">
                          <img
                            src={newPartner.logoUrl}
                            alt="Logo preview"
                            className="max-h-12 object-contain"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Configuration Section */}
                  <div className="space-y-4 border-t border-border-muted pt-4">
                    <Typography variant="bodySm" className="font-semibold flex items-center gap-2">
                      <IconCreditCard className="h-4 w-4" />
                      Payment Configuration
                    </Typography>

                    <Typography variant="bodyXs" colorRole="muted">
                      Select payment methods available for this partner (can enable both)
                    </Typography>

                    <div className="flex flex-col gap-4">
                      {/* Bank Transfer Checkbox */}
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newPartner.enableBankTransfer}
                          onChange={(e) =>
                            setNewPartner({
                              ...newPartner,
                              enableBankTransfer: e.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded border-border-primary text-fill-brand focus:ring-fill-brand"
                        />
                        <span className="text-sm font-medium">Bank Transfer</span>
                      </label>

                      {/* Payment Link Checkbox */}
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newPartner.enablePaymentLink}
                          onChange={(e) =>
                            setNewPartner({
                              ...newPartner,
                              enablePaymentLink: e.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded border-border-primary text-fill-brand focus:ring-fill-brand"
                        />
                        <span className="text-sm font-medium">Payment Link</span>
                      </label>
                    </div>

                    {newPartner.enableBankTransfer && (
                      <div className="grid grid-cols-2 gap-3 p-4 bg-fill-muted/50 rounded-lg">
                        <div>
                          <label className="block text-xs text-text-muted mb-1">Bank Name</label>
                          <input
                            type="text"
                            value={newPartner.paymentDetails.bankName || ''}
                            onChange={(e) =>
                              setNewPartner({
                                ...newPartner,
                                paymentDetails: {
                                  ...newPartner.paymentDetails,
                                  bankName: e.target.value,
                                },
                              })
                            }
                            className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-text-muted mb-1">Account Name</label>
                          <input
                            type="text"
                            value={newPartner.paymentDetails.accountName || ''}
                            onChange={(e) =>
                              setNewPartner({
                                ...newPartner,
                                paymentDetails: {
                                  ...newPartner.paymentDetails,
                                  accountName: e.target.value,
                                },
                              })
                            }
                            className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-text-muted mb-1">Account Number</label>
                          <input
                            type="text"
                            value={newPartner.paymentDetails.accountNumber || ''}
                            onChange={(e) =>
                              setNewPartner({
                                ...newPartner,
                                paymentDetails: {
                                  ...newPartner.paymentDetails,
                                  accountNumber: e.target.value,
                                },
                              })
                            }
                            className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-text-muted mb-1">IBAN</label>
                          <input
                            type="text"
                            value={newPartner.paymentDetails.iban || ''}
                            onChange={(e) =>
                              setNewPartner({
                                ...newPartner,
                                paymentDetails: {
                                  ...newPartner.paymentDetails,
                                  iban: e.target.value,
                                },
                              })
                            }
                            className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-text-muted mb-1">SWIFT/BIC</label>
                          <input
                            type="text"
                            value={newPartner.paymentDetails.swiftBic || ''}
                            onChange={(e) =>
                              setNewPartner({
                                ...newPartner,
                                paymentDetails: {
                                  ...newPartner.paymentDetails,
                                  swiftBic: e.target.value,
                                },
                              })
                            }
                            className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {newPartner.enablePaymentLink && (
                      <div className="p-4 bg-fill-muted/50 rounded-lg">
                        <label className="block text-xs text-text-muted mb-1">Payment URL</label>
                        <input
                          type="url"
                          value={newPartner.paymentDetails.paymentUrl || ''}
                          onChange={(e) =>
                            setNewPartner({
                              ...newPartner,
                              paymentDetails: {
                                ...newPartner.paymentDetails,
                                paymentUrl: e.target.value,
                              },
                            })
                          }
                          placeholder="https://pay.partner.com/..."
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-border-muted">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      <ButtonContent>Cancel</ButtonContent>
                    </Button>
                    <Button
                      type="submit"
                      variant="default"
                      colorRole="brand"
                      isDisabled={isCreating}
                    >
                      <ButtonContent>
                        {isCreating ? 'Creating...' : 'Add Partner'}
                      </ButtonContent>
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap gap-2">
              {(['all', 'active', 'inactive', 'suspended'] as const).map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  colorRole={statusFilter === status ? 'brand' : 'primary'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  <ButtonContent>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </ButtonContent>
                </Button>
              ))}
            </div>

            <div className="relative">
              <IconSearch className="text-text-muted absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by business name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-background-primary border-border-primary text-text-primary placeholder:text-text-muted w-full rounded-lg border px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <Typography variant="bodySm" className="text-text-muted">
              {isLoading ? 'Loading...' : `${partners.length} partners found`}
            </Typography>
          </CardContent>
        </Card>

        {/* Partners List */}
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <Typography variant="bodyMd" className="text-text-muted text-center">
                Loading partners...
              </Typography>
            </CardContent>
          </Card>
        ) : partners.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <Typography variant="bodyMd" className="text-text-muted text-center">
                No partners found. Click &quot;Add Partner&quot; to create one.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {partners.map((partner) => (
              <Card key={partner.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    {/* Partner Info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        {partner.logoUrl && (
                          <img
                            src={partner.logoUrl}
                            alt={partner.businessName}
                            className="h-10 w-10 object-contain rounded"
                          />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <Typography variant="headingSm">{partner.businessName}</Typography>
                            {getTypeBadge(partner.type)}
                            {getStatusBadge(partner.status)}
                          </div>
                          {partner.taxId && (
                            <Typography variant="bodyXs" colorRole="muted" className="flex items-center gap-1">
                              <IconReceipt className="h-3 w-3" />
                              TRN: {partner.taxId}
                            </Typography>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                        {partner.businessAddress && (
                          <div className="flex items-start gap-1.5 text-text-muted">
                            <IconMapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            <span className="text-xs">{partner.businessAddress}</span>
                          </div>
                        )}
                        {partner.businessEmail && (
                          <div className="flex items-center gap-1.5 text-text-muted">
                            <span className="text-xs">{partner.businessEmail}</span>
                          </div>
                        )}
                        {partner.businessPhone && (
                          <div className="flex items-center gap-1.5 text-text-muted">
                            <IconPhone className="h-3.5 w-3.5" />
                            <span className="text-xs">{partner.businessPhone}</span>
                          </div>
                        )}
                      </div>

                      {/* Payment Config Status */}
                      {partner.paymentDetails && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {(partner.paymentDetails.bankName || partner.paymentDetails.iban || partner.paymentDetails.accountNumber) && (
                            <span className="bg-fill-brand/10 text-text-brand border border-border-brand inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
                              Bank Transfer
                            </span>
                          )}
                          {partner.paymentDetails.paymentUrl && (
                            <span className="bg-fill-success/10 text-text-success border border-border-success inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
                              Payment Link
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions Section */}
                    <div className="flex-shrink-0 space-y-3">
                      {/* Edit Partner Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditPartner(partner)}
                        className="w-full"
                      >
                        <ButtonContent iconLeft={IconCreditCard}>Edit Details</ButtonContent>
                      </Button>

                      {/* API Keys Section */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Typography variant="bodySm" className="font-medium">
                            API Keys ({partner.apiKeyCount})
                          </Typography>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCreateApiKey(partner.id)}
                          >
                            <ButtonContent iconLeft={IconKey}>Generate Key</ButtonContent>
                          </Button>
                        </div>

                        {partner.apiKeys && partner.apiKeys.length > 0 && (
                          <div className="space-y-1">
                            {partner.apiKeys.map((key) => (
                              <div
                                key={key.id}
                                className={`flex items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm ${
                                  key.isRevoked
                                    ? 'bg-fill-muted/30 opacity-60'
                                    : 'bg-fill-muted/50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs">{key.keyPrefix}...</span>
                                  <span className="text-text-muted">{key.name}</span>
                                  {key.isRevoked && (
                                    <span className="bg-fill-danger/10 text-text-danger border border-border-danger inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
                                      Revoked
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  {/* Revoke button - only show for active keys */}
                                  {!key.isRevoked && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          colorRole="danger"
                                          isDisabled={isRevoking}
                                          title="Revoke API Key"
                                        >
                                          <ButtonContent iconLeft={IconLock} />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to revoke this API key? Any integrations
                                            using this key will immediately stop working.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => revokeApiKey({ apiKeyId: key.id })}
                                            className="bg-red-600 hover:bg-red-700"
                                          >
                                            Revoke Key
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                  {/* Delete button - show for all keys */}
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        colorRole="danger"
                                        isDisabled={isDeleting}
                                        title="Delete API Key"
                                      >
                                        <ButtonContent iconLeft={IconTrash} />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to permanently delete this API key?
                                          This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteApiKey({ apiKeyId: key.id })}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          Delete Key
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Partner Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Partner</DialogTitle>
              <DialogDescription>
                Update partner details and payment configuration
              </DialogDescription>
            </DialogHeader>

            {editingPartner && (
              <div className="space-y-6 mt-4">
                {/* Business Details */}
                <div className="space-y-4">
                  <Typography variant="bodySm" className="font-semibold flex items-center gap-2">
                    <IconBuilding className="h-4 w-4" />
                    Business Details
                  </Typography>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Business Name
                      </label>
                      <input
                        type="text"
                        value={editingPartner.businessName}
                        onChange={(e) =>
                          setEditingPartner({ ...editingPartner, businessName: e.target.value })
                        }
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        TRN / Tax ID
                      </label>
                      <input
                        type="text"
                        value={editingPartner.taxId}
                        onChange={(e) =>
                          setEditingPartner({ ...editingPartner, taxId: e.target.value })
                        }
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Commission Rate (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={editingPartner.commissionRate}
                        onChange={(e) =>
                          setEditingPartner({
                            ...editingPartner,
                            commissionRate: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Business Address
                      </label>
                      <textarea
                        value={editingPartner.businessAddress}
                        onChange={(e) =>
                          setEditingPartner({ ...editingPartner, businessAddress: e.target.value })
                        }
                        rows={2}
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={editingPartner.businessEmail}
                        onChange={(e) =>
                          setEditingPartner({ ...editingPartner, businessEmail: e.target.value })
                        }
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={editingPartner.businessPhone}
                        onChange={(e) =>
                          setEditingPartner({ ...editingPartner, businessPhone: e.target.value })
                        }
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Branding */}
                <div className="space-y-4 border-t border-border-muted pt-4">
                  <Typography variant="bodySm" className="font-semibold flex items-center gap-2">
                    <IconPhoto className="h-4 w-4" />
                    Branding
                  </Typography>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Logo URL
                    </label>
                    <input
                      type="url"
                      value={editingPartner.logoUrl}
                      onChange={(e) =>
                        setEditingPartner({ ...editingPartner, logoUrl: e.target.value })
                      }
                      placeholder="https://example.com/logo.png"
                      className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                    />
                    {editingPartner.logoUrl && (
                      <div className="mt-2 p-2 bg-fill-muted rounded-lg inline-block">
                        <img
                          src={editingPartner.logoUrl}
                          alt="Logo preview"
                          className="max-h-12 object-contain"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Configuration */}
                <div className="space-y-4 border-t border-border-muted pt-4">
                  <Typography variant="bodySm" className="font-semibold flex items-center gap-2">
                    <IconCreditCard className="h-4 w-4" />
                    Payment Configuration
                  </Typography>

                  <Typography variant="bodyXs" colorRole="muted">
                    Select payment methods available for this partner (can enable both)
                  </Typography>

                  <div className="flex flex-col gap-4">
                    {/* Bank Transfer Checkbox */}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingPartner.enableBankTransfer}
                        onChange={(e) =>
                          setEditingPartner({
                            ...editingPartner,
                            enableBankTransfer: e.target.checked,
                            paymentDetails: editingPartner.paymentDetails || {},
                          })
                        }
                        className="h-4 w-4 rounded border-border-primary text-fill-brand focus:ring-fill-brand"
                      />
                      <span className="text-sm font-medium">Bank Transfer</span>
                    </label>

                    {/* Payment Link Checkbox */}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingPartner.enablePaymentLink}
                        onChange={(e) =>
                          setEditingPartner({
                            ...editingPartner,
                            enablePaymentLink: e.target.checked,
                            paymentDetails: editingPartner.paymentDetails || {},
                          })
                        }
                        className="h-4 w-4 rounded border-border-primary text-fill-brand focus:ring-fill-brand"
                      />
                      <span className="text-sm font-medium">Payment Link</span>
                    </label>
                  </div>

                  {editingPartner.enableBankTransfer && (
                    <div className="grid grid-cols-2 gap-3 p-4 bg-fill-muted/50 rounded-lg">
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Bank Name</label>
                        <input
                          type="text"
                          value={editingPartner.paymentDetails?.bankName || ''}
                          onChange={(e) =>
                            setEditingPartner({
                              ...editingPartner,
                              paymentDetails: {
                                ...editingPartner.paymentDetails,
                                bankName: e.target.value,
                              },
                            })
                          }
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Account Name</label>
                        <input
                          type="text"
                          value={editingPartner.paymentDetails?.accountName || ''}
                          onChange={(e) =>
                            setEditingPartner({
                              ...editingPartner,
                              paymentDetails: {
                                ...editingPartner.paymentDetails,
                                accountName: e.target.value,
                              },
                            })
                          }
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Account Number</label>
                        <input
                          type="text"
                          value={editingPartner.paymentDetails?.accountNumber || ''}
                          onChange={(e) =>
                            setEditingPartner({
                              ...editingPartner,
                              paymentDetails: {
                                ...editingPartner.paymentDetails,
                                accountNumber: e.target.value,
                              },
                            })
                          }
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">IBAN</label>
                        <input
                          type="text"
                          value={editingPartner.paymentDetails?.iban || ''}
                          onChange={(e) =>
                            setEditingPartner({
                              ...editingPartner,
                              paymentDetails: {
                                ...editingPartner.paymentDetails,
                                iban: e.target.value,
                              },
                            })
                          }
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">SWIFT/BIC</label>
                        <input
                          type="text"
                          value={editingPartner.paymentDetails?.swiftBic || ''}
                          onChange={(e) =>
                            setEditingPartner({
                              ...editingPartner,
                              paymentDetails: {
                                ...editingPartner.paymentDetails,
                                swiftBic: e.target.value,
                              },
                            })
                          }
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {editingPartner.enablePaymentLink && (
                    <div className="p-4 bg-fill-muted/50 rounded-lg">
                      <label className="block text-xs text-text-muted mb-1">Payment URL</label>
                      <input
                        type="url"
                        value={editingPartner.paymentDetails?.paymentUrl || ''}
                        onChange={(e) =>
                          setEditingPartner({
                            ...editingPartner,
                            paymentDetails: {
                              ...editingPartner.paymentDetails,
                              paymentUrl: e.target.value,
                            },
                          })
                        }
                        placeholder="https://pay.partner.com/..."
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-border-muted">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    <ButtonContent>Cancel</ButtonContent>
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    colorRole="brand"
                    onClick={handleSavePartner}
                    isDisabled={isUpdating}
                  >
                    <ButtonContent>{isUpdating ? 'Saving...' : 'Save Changes'}</ButtonContent>
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Generate API Key Dialog */}
        <Dialog open={isApiKeyDialogOpen} onOpenChange={setIsApiKeyDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {generatedApiKey ? 'API Key Generated' : 'Generate API Key'}
              </DialogTitle>
              <DialogDescription>
                {generatedApiKey
                  ? "Copy this key now. You won't be able to see it again!"
                  : 'Create a new API key for this partner'}
              </DialogDescription>
            </DialogHeader>

            {generatedApiKey ? (
              <div className="space-y-4 mt-4">
                <div className="rounded-lg bg-fill-muted p-4">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-sm font-mono break-all">{generatedApiKey}</code>
                    <Button size="sm" variant="outline" onClick={handleCopyApiKey}>
                      <ButtonContent iconLeft={IconCopy}>
                        {copied ? 'Copied!' : 'Copy'}
                      </ButtonContent>
                    </Button>
                  </div>
                </div>
                <div className="bg-fill-warning/10 border border-border-warning rounded-lg p-3">
                  <Typography variant="bodySm" className="text-text-warning">
                    Save this key securely. It will only be shown once.
                  </Typography>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="default"
                    colorRole="brand"
                    onClick={() => {
                      setIsApiKeyDialogOpen(false);
                      setGeneratedApiKey(null);
                    }}
                  >
                    <ButtonContent>Done</ButtonContent>
                  </Button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (selectedPartnerId) {
                    createApiKey({
                      partnerId: selectedPartnerId,
                      name: newApiKey.name,
                      permissions: newApiKey.permissions,
                    });
                  }
                }}
                className="space-y-4 mt-4"
              >
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Key Name
                  </label>
                  <input
                    type="text"
                    value={newApiKey.name}
                    onChange={(e) => setNewApiKey({ ...newApiKey, name: e.target.value })}
                    placeholder="e.g., POS Integration"
                    className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Permissions
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newApiKey.permissions.includes('read:inventory')}
                        onChange={(e) => {
                          const perms = e.target.checked
                            ? [...newApiKey.permissions, 'read:inventory']
                            : newApiKey.permissions.filter((p) => p !== 'read:inventory');
                          setNewApiKey({ ...newApiKey, permissions: perms });
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">read:inventory - Access product catalog</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsApiKeyDialogOpen(false)}
                  >
                    <ButtonContent>Cancel</ButtonContent>
                  </Button>
                  <Button
                    type="submit"
                    variant="default"
                    colorRole="brand"
                    isDisabled={isCreatingKey}
                  >
                    <ButtonContent iconLeft={IconKey}>
                      {isCreatingKey ? 'Generating...' : 'Generate Key'}
                    </ButtonContent>
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default PartnersPage;
